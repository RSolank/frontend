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

export function TagFormDialog({
  open,
  onClose,
  onSaved,
  editingTag = null,
  isSystemTag = false,
  flatTags,
  onRequestRemove,
}: TagFormDialogProps) {
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
            parent:
              editingTag.parent != null ? String(editingTag.parent) : '',
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

  const childrenList = useMemo(
    () => editingTag?.children ?? [],
    [editingTag]
  );

  // Title = entity identifier per the DetailModal convention.
  const title = isEditing ? editingTag.tag_name || 'Tag' : 'New tag';
  const dismissLabel = isDirty ? 'Cancel' : 'Close';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={title}
      description={
        isEditing ? (isSystemTag ? 'System tag' : 'Your tag') : undefined
      }
      confirmOnDirty
      isDirty={isDirty}
      headerActions={
        isEditing && !isSystemTag && onRequestRemove ? (
          <button
            type="button"
            onClick={onRequestRemove}
            disabled={saving}
            aria-label="Remove tag"
            title="Remove tag"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
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
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {dismissLabel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty || !form.tag_name.trim()}
            className="btn-primary !w-auto"
          >
            {saving ? 'Saving…' : isEditing ? 'Update tag' : 'Create tag'}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <LockedFieldBanner reason={lockedReason} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="tag-name" className="form-label">
              Tag name
            </label>
            <input
              id="tag-name"
              value={form.tag_name}
              readOnly={isSystemTag}
              onChange={(e) => {
                clearLockedBannerOnEdit();
                setForm((f) => ({ ...f, tag_name: e.target.value }));
              }}
              onClick={
                isSystemTag
                  ? () => setLockedReason(SYSTEM_TAG_LOCK_REASON)
                  : undefined
              }
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
              value={form.tag_type}
              onChange={(e) => {
                clearLockedBannerOnEdit();
                setForm((f) => ({
                  ...f,
                  tag_type: e.target.value as TagFormInput['tag_type'],
                }));
              }}
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
                onClick={() => setLockedReason(SYSTEM_TAG_LOCK_REASON)}
                className="form-input cursor-not-allowed bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
              />
            ) : (
              <SearchableSelect
                id="tag-parent"
                ariaLabel="Parent tag"
                placeholder="— None (top-level) —"
                value={form.parent}
                options={parentSelectOptions}
                onChange={(next) => {
                  clearLockedBannerOnEdit();
                  setForm((f) => ({ ...f, parent: next }));
                }}
              />
            )}
          </div>
        </div>

        <div>
          <label htmlFor="tag-alias" className="form-label">
            Aliases
          </label>
          <div className="mb-2 flex gap-2">
            <input
              id="tag-alias"
              value={aliasTemp}
              onChange={(e) => setAliasTemp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAlias();
                }
              }}
              placeholder="Enter alias (e.g. Netflix, Spotify)"
              className="form-input flex-1"
            />
            <button
              type="button"
              onClick={addAlias}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Add
            </button>
          </div>
          <div className="flex min-h-12 flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            {form.aliases.length === 0 ? (
              <span className="text-sm text-slate-400 dark:text-slate-500">
                No aliases added
              </span>
            ) : (
              form.aliases.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  {a}
                  <button
                    type="button"
                    onClick={() => removeAlias(a)}
                    aria-label={`Remove alias ${a}`}
                    className="ml-0.5 text-base leading-none font-bold text-indigo-500 dark:text-indigo-400"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {childrenList.length > 0 && (
          <div>
            <span className="form-label">Children ({childrenList.length})</span>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {childrenList.map((c) => c.tag_name).join(', ')}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              These descend from this tag and inherit its categorisation
              when matched. Renaming or reparenting can affect them.
            </p>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
      </div>
    </Modal>
  );
}
