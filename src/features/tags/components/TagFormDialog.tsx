import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { LockedFieldBanner } from '../../../shared/components/LockedFieldBanner';
import { Modal } from '../../../shared/components/Modal';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import {
  createTagRequest,
  updateTagRequest,
  type CreatedTag,
} from '../api/mutations';
import type { TagNode } from '../api/queries';
import { tagFormToPayload, type TagFormInput } from '../api/schemas';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

const TAG_TYPES: { value: TagFormInput['tag_type']; label: string }[] = [
  { value: 'essential', label: 'Essential' },
  { value: 'discretionary', label: 'Discretionary' },
  { value: 'committed', label: 'Committed' },
  { value: 'exempted', label: 'Exempted' },
  { value: 'income', label: 'Income' },
];

const EMPTY_FORM: TagFormInput = {
  tag_name: '',
  parent: '',
  tag_type: 'discretionary',
  aliases: [],
};

// Seamless-transition lock messages (Batch 9.8). The text mirrors
// the original system-tag tooltip so the user gets the same
// explanation whether they hover the row or click into the locked
// modal field.
const SYSTEM_TAG_LOCK_REASON =
  'System tags ship with a fixed name and parent. You can still edit Tag Type and Aliases — those are what the categorisation engine actually keys on.';

interface TagFormDialogProps {
  open: boolean;
  onClose: () => void;
  // Called after a successful save. For *create* the new tag is passed
  // back so callers can auto-select it; for *update* the arg is
  // omitted. Most callers only need the side-effect (invalidate
  // queries) so the argument is optional.
  onSaved: (createdTag?: CreatedTag) => void | Promise<void>;
  // Modal-header Remove-in-edit convention (see CONTRIBUTING.md §6
  // "Modal header destructive actions"). When set, an icon-only Trash
  // button renders in the modal header for edit mode. Parent owns the
  // confirm + mutation flow — keeps the dialog focused on the form.
  onRequestRemove?: () => void;
  // When set, the dialog edits the matching tag; when null, it creates.
  editingTag?: TagNode | null;
  isSystemTag?: boolean;
  flatTags: FlatTag[];
}

// Modal heading: the tag's name in Edit (entity identifier per the
// DetailModal convention), a fixed prefix in Add.
function tagTitle(isEditing: boolean, editingTag: TagNode | null): string {
  if (!isEditing) return 'New tag';
  return editingTag?.tag_name || 'Tag';
}

// Modal sub-description: ownership pill in Edit, nothing in Add. if/else so
// it stays off sonarjs/no-nested-conditional.
function tagDescription(
  isEditing: boolean,
  isSystemTag: boolean
): string | undefined {
  if (!isEditing) return undefined;
  return isSystemTag ? 'System tag' : 'Your tag';
}

// Save-button label by state — if/else for the same reason.
function tagSaveLabel(saving: boolean, isEditing: boolean): string {
  if (saving) return 'Saving…';
  return isEditing ? 'Update tag' : 'Create tag';
}

interface UseTagFormArgs {
  open: boolean;
  editingTag: TagNode | null;
  flatTags: FlatTag[];
  onSaved: (createdTag?: CreatedTag) => void | Promise<void>;
  onClose: () => void;
}

// All of the dialog's state, effects, derived values and handlers. Pulled
// out so the render stays a presentational shell under the complexity /
// line-count gates. Verbatim relocation of the previous inline logic;
// reference data (flatTags) arrives via props, so nothing here subscribes a
// query.
function useTagForm({
  open,
  editingTag,
  flatTags,
  onSaved,
  onClose,
}: UseTagFormArgs) {
  const isEditing = editingTag != null;

  const [form, setForm] = useState<TagFormInput>(EMPTY_FORM);
  const [aliasTemp, setAliasTemp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Locked-field banner state — surfaces only when the user clicks a
  // readOnly field. Auto-clears on next successful edit.
  const [lockedReason, setLockedReason] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingTag) {
      setForm({
        tag_name: editingTag.tag_name,
        parent: editingTag.parent != null ? String(editingTag.parent) : '',
        tag_type:
          (editingTag.tag_type as TagFormInput['tag_type']) ?? 'discretionary',
        aliases: editingTag.aliases ?? [],
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setAliasTemp('');
    setError(null);
    setSaving(false);
    setLockedReason(null);
  }, [open, editingTag]);

  // Snapshot of the loaded tag's values — drives isDirty + ensures
  // the Save button stays disabled until the user changes something.
  const originalForm = useMemo<TagFormInput>(
    () =>
      editingTag
        ? {
            tag_name: editingTag.tag_name,
            parent: editingTag.parent != null ? String(editingTag.parent) : '',
            tag_type:
              (editingTag.tag_type as TagFormInput['tag_type']) ??
              'discretionary',
            aliases: editingTag.aliases ?? [],
          }
        : EMPTY_FORM,
    [editingTag]
  );

  const isDirty = useMemo(() => {
    if (!isEditing) return true; // any open Add is dirty
    if (form.tag_name !== originalForm.tag_name) return true;
    if (form.parent !== originalForm.parent) return true;
    if (form.tag_type !== originalForm.tag_type) return true;
    if (form.aliases.length !== originalForm.aliases.length) return true;
    for (let i = 0; i < form.aliases.length; i++) {
      if (form.aliases[i] !== originalForm.aliases[i]) return true;
    }
    return false;
  }, [isEditing, form, originalForm]);

  function clearLockedBannerOnEdit() {
    if (lockedReason) setLockedReason(null);
  }

  function addAlias() {
    const val = aliasTemp.trim();
    if (!val) return;
    if (form.aliases.includes(val)) {
      setAliasTemp('');
      return;
    }
    setForm((f) => ({ ...f, aliases: [...f.aliases, val] }));
    setAliasTemp('');
    clearLockedBannerOnEdit();
  }

  function removeAlias(val: string) {
    setForm((f) => ({ ...f, aliases: f.aliases.filter((a) => a !== val) }));
    clearLockedBannerOnEdit();
  }

  async function handleSave() {
    setError(null);
    if (!form.tag_name.trim()) {
      setError('Tag name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = tagFormToPayload(form);
      if (editingTag) {
        await updateTagRequest(editingTag.tag_id, payload);
        await onSaved({ tag_id: editingTag.tag_id });
      } else {
        const res = await createTagRequest(payload);
        await onSaved(res.tag);
      }
      // Row-highlight on the parent surfaces success; close cleanly.
      onClose();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  }

  const parentOptions = useMemo(
    () => flatTags.filter((t) => t.tag_id !== editingTag?.tag_id),
    [flatTags, editingTag]
  );

  const parentSelectOptions = useMemo(
    () => [
      { value: '', label: '— None (top-level) —' },
      ...parentOptions.map((t) => ({
        value: String(t.tag_id),
        label: t.tag_name,
      })),
    ],
    [parentOptions]
  );

  const parentLabel =
    parentSelectOptions.find((o) => o.value === form.parent)?.label ??
    '— None (top-level) —';

  const childrenList = useMemo(() => editingTag?.children ?? [], [editingTag]);

  const saveDisabled = saving || !isDirty || !form.tag_name.trim();

  return {
    form,
    setForm,
    aliasTemp,
    setAliasTemp,
    error,
    saving,
    lockedReason,
    setLockedReason,
    isEditing,
    isDirty,
    parentSelectOptions,
    parentLabel,
    childrenList,
    saveDisabled,
    clearLockedBannerOnEdit,
    addAlias,
    removeAlias,
    handleSave,
  };
}

export function TagFormDialog({
  open,
  onClose,
  onSaved,
  editingTag = null,
  isSystemTag = false,
  flatTags,
  onRequestRemove,
}: TagFormDialogProps) {
  const f = useTagForm({ open, editingTag, flatTags, onSaved, onClose });

  const title = tagTitle(f.isEditing, editingTag);
  const dismissLabel = f.isDirty ? 'Cancel' : 'Close';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={title}
      description={tagDescription(f.isEditing, isSystemTag)}
      confirmOnDirty
      isDirty={f.isDirty}
      headerActions={
        f.isEditing && !isSystemTag && onRequestRemove ? (
          <button
            type="button"
            onClick={onRequestRemove}
            disabled={f.saving}
            aria-label="Remove tag"
            title="Remove tag"
            className="text-danger-600 hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-500 dark:text-danger-400 dark:hover:bg-danger-950/40 dark:hover:text-danger-300 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="tag-form-remove"
          >
            <Trash2 aria-hidden size={16} />
          </button>
        ) : null
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={f.saving}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {dismissLabel}
          </button>
          <button
            type="button"
            onClick={f.handleSave}
            disabled={f.saveDisabled}
            className="btn-primary !w-auto"
          >
            {tagSaveLabel(f.saving, f.isEditing)}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <LockedFieldBanner reason={f.lockedReason} />

        <TagFieldsGrid
          tagName={f.form.tag_name}
          tagType={f.form.tag_type}
          parentValue={f.form.parent}
          isSystemTag={isSystemTag}
          parentSelectOptions={f.parentSelectOptions}
          parentLabel={f.parentLabel}
          onNameChange={(value) => {
            f.clearLockedBannerOnEdit();
            f.setForm((prev) => ({ ...prev, tag_name: value }));
          }}
          onTypeChange={(value) => {
            f.clearLockedBannerOnEdit();
            f.setForm((prev) => ({ ...prev, tag_type: value }));
          }}
          onParentChange={(value) => {
            f.clearLockedBannerOnEdit();
            f.setForm((prev) => ({ ...prev, parent: value }));
          }}
          onLockedClick={() => f.setLockedReason(SYSTEM_TAG_LOCK_REASON)}
        />

        <AliasEditor
          aliasTemp={f.aliasTemp}
          aliases={f.form.aliases}
          onAliasTempChange={f.setAliasTemp}
          onAdd={f.addAlias}
          onRemove={f.removeAlias}
        />

        {f.childrenList.length > 0 && (
          <div>
            <span className="form-label">
              Children ({f.childrenList.length})
            </span>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {f.childrenList.map((c) => c.tag_name).join(', ')}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              These descend from this tag and inherit its categorisation when
              matched. Renaming or reparenting can affect them.
            </p>
          </div>
        )}

        {f.error && <div className="form-error">{f.error}</div>}
      </div>
    </Modal>
  );
}

interface TagFieldsGridProps {
  tagName: string;
  tagType: TagFormInput['tag_type'];
  parentValue: string;
  isSystemTag: boolean;
  parentSelectOptions: { value: string; label: string }[];
  parentLabel: string;
  onNameChange: (value: string) => void;
  onTypeChange: (value: TagFormInput['tag_type']) => void;
  onParentChange: (value: string) => void;
  onLockedClick: () => void;
}

// The 3-column field grid: name (system-locked readOnly), tag type, and
// parent (system-locked readOnly input or the searchable picker). Split out
// of the dialog to keep that component under the complexity / line gates.
function TagFieldsGrid({
  tagName,
  tagType,
  parentValue,
  isSystemTag,
  parentSelectOptions,
  parentLabel,
  onNameChange,
  onTypeChange,
  onParentChange,
  onLockedClick,
}: TagFieldsGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="tag-name" className="form-label">
          Tag name
        </label>
        <input
          id="tag-name"
          value={tagName}
          readOnly={isSystemTag}
          onChange={(e) => onNameChange(e.target.value)}
          onClick={isSystemTag ? onLockedClick : undefined}
          placeholder="e.g. Subscriptions"
          className={`form-input ${
            isSystemTag
              ? 'cursor-not-allowed bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
              : ''
          }`}
        />
      </div>
      <div>
        <label htmlFor="tag-type" className="form-label">
          Tag Type
        </label>
        <select
          id="tag-type"
          value={tagType}
          onChange={(e) =>
            onTypeChange(e.target.value as TagFormInput['tag_type'])
          }
          className="form-input"
        >
          {TAG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="tag-parent" className="form-label">
          Parent (optional)
        </label>
        {isSystemTag ? (
          <input
            id="tag-parent"
            value={parentLabel}
            readOnly
            onClick={onLockedClick}
            className="form-input cursor-not-allowed bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
          />
        ) : (
          <SearchableSelect
            id="tag-parent"
            ariaLabel="Parent tag"
            placeholder="— None (top-level) —"
            value={parentValue}
            options={parentSelectOptions}
            onChange={onParentChange}
          />
        )}
      </div>
    </div>
  );
}

interface AliasEditorProps {
  aliasTemp: string;
  aliases: string[];
  onAliasTempChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (alias: string) => void;
}

// Alias entry field (+ Add / Enter) and the selected-alias chip list. Split
// out of the dialog for the same complexity / line-count reason.
function AliasEditor({
  aliasTemp,
  aliases,
  onAliasTempChange,
  onAdd,
  onRemove,
}: AliasEditorProps) {
  return (
    <div>
      <label htmlFor="tag-alias" className="form-label">
        Aliases
      </label>
      <div className="mb-2 flex gap-2">
        <input
          id="tag-alias"
          value={aliasTemp}
          onChange={(e) => onAliasTempChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Enter alias (e.g. Netflix, Spotify)"
          className="form-input flex-1"
        />
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Add
        </button>
      </div>
      <div className="flex min-h-12 flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {aliases.length === 0 ? (
          <span className="text-sm text-slate-400 dark:text-slate-500">
            No aliases added
          </span>
        ) : (
          aliases.map((a) => (
            <span
              key={a}
              className="border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900/50 dark:bg-accent-950/40 dark:text-accent-300 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
            >
              {a}
              <button
                type="button"
                onClick={() => onRemove(a)}
                aria-label={`Remove alias ${a}`}
                className="text-accent-500 dark:text-accent-400 ml-0.5 text-base leading-none font-bold"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
