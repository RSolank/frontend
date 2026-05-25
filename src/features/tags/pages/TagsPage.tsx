import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { tagKeys } from '../api/keys';
import {
  createTagRequest,
  deleteTagRequest,
  updateTagRequest,
} from '../api/mutations';
import {
  fetchTagConstants,
  useTagsQuery,
  type TagConstants,
  type TagNode,
} from '../api/queries';
import { tagFormToPayload, type TagFormInput } from '../api/schemas';

interface ApiErrorShape {
  detail?: string;
  error?: string;
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

function sortTagsById(nodes: TagNode[]): TagNode[] {
  return [...nodes]
    .sort((a, b) => a.tag_id - b.tag_id)
    .map((n) => ({ ...n, children: n.children ? sortTagsById(n.children) : [] }));
}

interface FlatTag {
  tag_id: number;
  tag_name: string;
  parent: number | null;
  created_by: number | null;
  tag_type: string;
  aliases: string[];
}

function flattenTags(nodes: TagNode[] | undefined, out: FlatTag[] = []): FlatTag[] {
  for (const n of nodes ?? []) {
    out.push({
      tag_id: n.tag_id,
      tag_name: n.tag_name,
      parent: n.parent,
      created_by: n.created_by,
      tag_type: n.tag_type,
      aliases: n.aliases ?? [],
    });
    flattenTags(n.children, out);
  }
  return out;
}

interface TagRowProps {
  tag: TagNode;
  onEdit: (tag: TagNode) => void;
  onDelete: (tagId: number) => void;
  constants: TagConstants | null;
  level: number;
}

function TagRow({ tag, onEdit, onDelete, constants, level }: TagRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = !!tag.children && tag.children.length > 0;

  const isSystem =
    tag.created_by === null || tag.created_by === constants?.SYSTEM_USER_ID;
  const isRestricted =
    tag.tag_id === constants?.TOTAL_TAG_ID ||
    tag.tag_id === constants?.MISCELLANEOUS_TAG_ID ||
    tag.tag_id === constants?.CONSUMPTION_TAX_TAG_ID;

  const stripeClass =
    level % 2 === 0
      ? 'bg-transparent'
      : 'bg-slate-50 dark:bg-slate-900/40';

  // Mobile-first: rows wrap content + action buttons vertically when
  // the inline layout can't fit (deep nesting + long names + chips).
  // `min-w-0` lets the inner content area shrink past its intrinsic
  // width so flex-wrap inside it can break long alias chip rows
  // instead of forcing horizontal overflow.
  return (
    <>
      <li
        className={`flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:flex-nowrap sm:items-center dark:border-slate-800 ${stripeClass}`}
      >
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          style={{ paddingLeft: `${level * 1.5}rem` }}
        >
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            className={`flex h-5 w-5 items-center justify-center text-xs text-slate-500 transition-transform dark:text-slate-400 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            } ${hasChildren ? 'visible' : 'invisible'}`}
          >
            ▼
          </button>
          <span
            className={`text-sm text-slate-800 dark:text-slate-100 ${
              tag.parent == null ? 'font-semibold' : 'font-normal'
            }`}
          >
            {tag.tag_name}
          </span>
          <span className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
            [{tag.tag_type}]
          </span>
          {tag.aliases && tag.aliases.length > 0 && (
            <div className="ml-1 flex flex-wrap gap-1">
              {tag.aliases.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
          {isSystem && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              (system)
            </span>
          )}
        </div>
        <div className="ml-0 flex shrink-0 gap-2 sm:ml-3">
          {!isRestricted && (
            <button
              type="button"
              onClick={() => onEdit(tag)}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Update
            </button>
          )}
          {!isSystem && (
            <button
              type="button"
              onClick={() => onDelete(tag.tag_id)}
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
            >
              Delete
            </button>
          )}
        </div>
      </li>
      {hasChildren && isExpanded && (
        <TagTree
          tags={tag.children ?? []}
          onEdit={onEdit}
          onDelete={onDelete}
          constants={constants}
          level={level + 1}
        />
      )}
    </>
  );
}

interface TagTreeProps {
  tags: TagNode[];
  onEdit: (tag: TagNode) => void;
  onDelete: (tagId: number) => void;
  constants: TagConstants | null;
  level?: number;
}

function TagTree({ tags, onEdit, onDelete, constants, level = 0 }: TagTreeProps) {
  if (!tags || tags.length === 0) return null;
  return (
    <ul className="m-0 list-none p-0">
      {tags.map((t) => (
        <TagRow
          key={t.tag_id}
          tag={t}
          onEdit={onEdit}
          onDelete={onDelete}
          constants={constants}
          level={level}
        />
      ))}
    </ul>
  );
}

export function TagsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useTagsQuery();
  const tags = useMemo(() => sortTagsById(data?.tags ?? []), [data]);
  const flatTags = useMemo(() => flattenTags(tags), [tags]);

  const [constants, setConstants] = useState<TagConstants | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [form, setForm] = useState<TagFormInput>(EMPTY_FORM);
  const [aliasTemp, setAliasTemp] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setConstants(await fetchTagConstants());
      } catch (err) {
        console.error('Failed to load constants', err);
      }
    })();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setAliasTemp('');
    setEditingTagId(null);
    setIsFormVisible(false);
    setError(null);
  }

  function handleEdit(tag: TagNode) {
    setEditingTagId(tag.tag_id);
    setForm({
      tag_name: tag.tag_name,
      parent: tag.parent != null ? String(tag.parent) : '',
      tag_type:
        (tag.tag_type as TagFormInput['tag_type']) ?? 'discretionary',
      aliases: tag.aliases ?? [],
    });
    setAliasTemp('');
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(tagId: number) {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    try {
      await deleteTagRequest(tagId);
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to delete tag');
    }
  }

  function handleAddAlias() {
    const val = aliasTemp.trim();
    if (!val) return;
    if (form.aliases.includes(val)) {
      setAliasTemp('');
      return;
    }
    setForm((f) => ({ ...f, aliases: [...f.aliases, val] }));
    setAliasTemp('');
  }

  function handleRemoveAlias(val: string) {
    setForm((f) => ({ ...f, aliases: f.aliases.filter((a) => a !== val) }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!form.tag_name.trim()) return;

    const payload = tagFormToPayload(form);
    try {
      if (editingTagId) {
        await updateTagRequest(editingTagId, payload);
      } else {
        await createTagRequest(payload);
      }
      resetForm();
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save tag');
    }
  }

  const isSystemTag = useMemo(() => {
    if (!editingTagId) return false;
    const tag = flatTags.find((t) => t.tag_id === editingTagId);
    return (
      tag?.created_by === null ||
      tag?.created_by === constants?.SYSTEM_USER_ID
    );
  }, [editingTagId, flatTags, constants]);

  return (
    <div className="mx-auto my-8 max-w-3xl px-4">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Categories &amp; tags
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Organize transactions and feed the auto-categorization engine.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
        >
          ← Back to dashboard
        </Link>
      </header>

      <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            All tags
          </h2>
          <button
            type="button"
            onClick={() => (isFormVisible ? resetForm() : setIsFormVisible(true))}
            className="btn-primary !w-auto"
          >
            {isFormVisible ? 'Cancel' : 'Add Tag'}
          </button>
        </div>

        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          System tags (seeded defaults) can only be partially edited (aliases
          and tag types). Custom categories and subcategories can be added
          below.{' '}
          <strong className="text-slate-700 dark:text-slate-200">
            Aliases help the auto-categorization engine to tag your
            transactions correctly.
          </strong>
        </p>

        {isFormVisible && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
          >
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
                  {flatTags
                    .filter((t) => t.tag_id !== editingTagId)
                    .map((t) => (
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
                      handleAddAlias();
                    }
                  }}
                  placeholder="Enter alias (e.g. Netflix, Spotify)"
                  className="form-input flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddAlias}
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
                        onClick={() => handleRemoveAlias(a)}
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

            <div className="flex gap-3">
              <button type="submit" className="btn-primary !w-auto">
                {editingTagId ? 'Update Tag' : 'Create Tag'}
              </button>
              {editingTagId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {error && <div className="form-error mb-4">{error}</div>}

        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {flatTags.length} tags total
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Loading tags...
            </p>
          ) : (
            <TagTree
              tags={tags}
              onEdit={handleEdit}
              onDelete={handleDelete}
              constants={constants}
            />
          )}
        </div>
      </section>
    </div>
  );
}
