import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
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

interface TagFormDialogProps {
  open: boolean;
  onClose: () => void;
  // Called after a successful save. For *create* the new tag is passed
  // back so callers can auto-select it; for *update* the arg is
  // omitted. Most callers only need the side-effect (invalidate
  // queries) so the argument is optional.
  onSaved: (createdTag?: CreatedTag) => void | Promise<void>;
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
}: TagFormDialogProps) {
  const [form, setForm] = useState<TagFormInput>(EMPTY_FORM);
  const [aliasTemp, setAliasTemp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = editingTag != null;

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
  }, [open, editingTag]);

  function addAlias() {
    const val = aliasTemp.trim();
    if (!val) return;
    if (form.aliases.includes(val)) {
      setAliasTemp('');
      return;
    }
    setForm((f) => ({ ...f, aliases: [...f.aliases, val] }));
    setAliasTemp('');
  }

  function removeAlias(val: string) {
    setForm((f) => ({ ...f, aliases: f.aliases.filter((a) => a !== val) }));
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
        // Forward the edited tag id so the parent can flash the row
        // (Row highlight on save — CONTRIBUTING.md §6). Create + edit
        // both surface a `{ tag_id }` shape via this single callback.
        await onSaved({ tag_id: editingTag.tag_id });
      } else {
        const res = await createTagRequest(payload);
        await onSaved(res.tag);
      }
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isEditing ? 'Edit tag' : 'Create tag'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.tag_name.trim()}
            className="btn-primary !w-auto"
          >
            {saving ? 'Saving…' : isEditing ? 'Update tag' : 'Create tag'}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="tag-name" className="form-label">
              Tag name
            </label>
            <input
              id="tag-name"
              value={form.tag_name}
              disabled={isSystemTag}
              onChange={(e) =>
                setForm((f) => ({ ...f, tag_name: e.target.value }))
              }
              placeholder="e.g. Subscriptions"
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="tag-type" className="form-label">
              Tag Type
            </label>
            <select
              id="tag-type"
              value={form.tag_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tag_type: e.target.value as TagFormInput['tag_type'],
                }))
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
            <select
              id="tag-parent"
              value={form.parent}
              disabled={isSystemTag}
              onChange={(e) =>
                setForm((f) => ({ ...f, parent: e.target.value }))
              }
              className="form-input"
            >
              <option value="">— None (top-level) —</option>
              {parentOptions.map((t) => (
                <option key={t.tag_id} value={t.tag_id}>
                  {t.tag_name}
                </option>
              ))}
            </select>
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

        {error && <div className="form-error">{error}</div>}
      </div>
    </Modal>
  );
}
