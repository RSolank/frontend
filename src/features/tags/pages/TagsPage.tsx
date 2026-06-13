import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { SystemChip } from '../../../shared/components/SystemChip';
import { useModal, useUrlValueModal } from '../../../shared/hooks/useModal';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { tagKeys } from '../api/keys';
import type { CreatedTag } from '../api/mutations';
import { deleteTagRequest } from '../api/mutations';
import {
  fetchTagConstants,
  useTagsQuery,
  type TagConstants,
  type TagNode,
} from '../api/queries';
import { TagFormDialog } from '../components/TagFormDialog';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

function sortTagsById(nodes: TagNode[]): TagNode[] {
  return [...nodes]
    .sort((a, b) => a.tag_id - b.tag_id)
    .map((n) => ({
      ...n,
      children: n.children ? sortTagsById(n.children) : [],
    }));
}

interface FlatTag {
  tag_id: number;
  tag_name: string;
  parent: number | null;
  created_by: number | null;
  tag_type: string;
  aliases: string[];
}

function flattenTags(
  nodes: TagNode[] | undefined,
  out: FlatTag[] = []
): FlatTag[] {
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

// Accessible name for the row toggle — undefined for a leaf (the button is
// disabled and non-interactive), else Collapse/Expand. if/else (not a nested
// ternary) so it stays off sonarjs/no-nested-conditional.
function expandToggleLabel(
  hasChildren: boolean,
  isExpanded: boolean
): string | undefined {
  if (!hasChildren) return undefined;
  return isExpanded ? 'Collapse' : 'Expand';
}

// The row's label/toggle button: chevron + name + type + alias chips. Split
// out of TagRow to keep the parent's render branch count under the gate; all
// logic is presentational. The expansion state + handler live in the parent
// (the state owner) and arrive as props.
interface TagRowLabelProps {
  tag: TagNode;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isSystem: boolean;
  onToggle: () => void;
}

function TagRowLabel({
  tag,
  level,
  hasChildren,
  isExpanded,
  isSystem,
  onToggle,
}: TagRowLabelProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expandToggleLabel(hasChildren, isExpanded)}
      aria-expanded={hasChildren ? isExpanded : undefined}
      disabled={!hasChildren}
      className={`focus-visible:ring-accent-500 flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-sm text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        hasChildren
          ? 'cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          : 'cursor-default'
      } disabled:opacity-100`}
      style={{ paddingLeft: `${level * 1.5}rem` }}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center text-xs text-slate-500 transition-transform dark:text-slate-400 ${
          isExpanded ? 'rotate-0' : '-rotate-90'
        } ${hasChildren ? 'visible' : 'invisible'}`}
        aria-hidden="true"
      >
        ▼
      </span>
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
      {/*
       * "System" chip on seeded tags. Supersedes the 2026-05-27
       * quiet-chrome lock (no always-on "(system)" badge): the chip is
       * now wanted for consistency with the other seeded-data pages so
       * the user can tell shipped tags from ones they added. The
       * on-demand affordances (partial-edit tooltip, hidden delete,
       * locked modal fields) still apply on top.
       */}
      {isSystem && <SystemChip />}
      {tag.aliases && tag.aliases.length > 0 && (
        <span className="ml-1 flex flex-wrap gap-1">
          {tag.aliases.map((a) => (
            <span
              key={a}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {a}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

// The row's action cluster — the ⋯ View/edit affordance. Hidden for the three
// restricted system tags; tooltip differs for editable system tags (alias-only
// edits). Split out of TagRow for the same complexity-gate reason.
interface TagRowActionsProps {
  tag: TagNode;
  onEdit: (tag: TagNode) => void;
  isRestricted: boolean;
  isSystem: boolean;
}

function TagRowActions({
  tag,
  onEdit,
  isRestricted,
  isSystem,
}: TagRowActionsProps) {
  return (
    <div className="ml-0 flex shrink-0 sm:ml-3">
      {!isRestricted && (
        <button
          type="button"
          onClick={() => onEdit(tag)}
          aria-label={`View / edit tag ${tag.tag_name}`}
          title={
            isSystem
              ? 'View — system tags allow alias edits only'
              : 'View / edit'
          }
          className="focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <MoreHorizontal aria-hidden size={16} />
        </button>
      )}
    </div>
  );
}

interface TagRowProps {
  tag: TagNode;
  onEdit: (tag: TagNode) => void;
  constants: TagConstants | null;
  level: number;
  highlightTagId: number | null;
}

function TagRow({
  tag,
  onEdit,
  constants,
  level,
  highlightTagId,
}: TagRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = !!tag.children && tag.children.length > 0;

  const isSystem =
    tag.created_by === null || tag.created_by === constants?.SYSTEM_USER_ID;
  const isRestricted =
    tag.tag_id === constants?.TOTAL_TAG_ID ||
    tag.tag_id === constants?.MISCELLANEOUS_TAG_ID ||
    tag.tag_id === constants?.CONSUMPTION_TAX_TAG_ID;

  const stripeClass =
    level % 2 === 0 ? 'bg-transparent' : 'bg-slate-50 dark:bg-slate-900/40';
  const highlightClass =
    highlightTagId === tag.tag_id
      ? 'bg-accent-50/60 ring-2 ring-accent-500 ring-inset dark:bg-accent-950/30'
      : '';

  // Toggle the expansion when the row content area is clicked. The
  // chevron stays as a visual affordance but is no longer the only
  // hit target. Disabled when the tag has no children so clicking a
  // leaf row is a no-op rather than a non-interactive button.
  function handleRowToggle() {
    if (hasChildren) setIsExpanded((v) => !v);
  }

  return (
    <>
      <li
        className={`flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 transition-colors sm:flex-nowrap sm:items-center dark:border-slate-800 ${stripeClass} ${highlightClass}`}
      >
        <TagRowLabel
          tag={tag}
          level={level}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          isSystem={isSystem}
          onToggle={handleRowToggle}
        />
        <TagRowActions
          tag={tag}
          onEdit={onEdit}
          isRestricted={isRestricted}
          isSystem={isSystem}
        />
      </li>
      {hasChildren && isExpanded && (
        <TagTree
          tags={tag.children ?? []}
          onEdit={onEdit}
          constants={constants}
          level={level + 1}
          highlightTagId={highlightTagId}
        />
      )}
    </>
  );
}

interface TagTreeProps {
  tags: TagNode[];
  onEdit: (tag: TagNode) => void;
  constants: TagConstants | null;
  level?: number;
  highlightTagId: number | null;
}

function TagTree({
  tags,
  onEdit,
  constants,
  level = 0,
  highlightTagId,
}: TagTreeProps) {
  if (!tags || tags.length === 0) return null;
  return (
    <ul className="m-0 list-none p-0">
      {tags.map((t) => (
        <TagRow
          key={t.tag_id}
          tag={t}
          onEdit={onEdit}
          constants={constants}
          level={level}
          highlightTagId={highlightTagId}
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
  const [editingTag, setEditingTag] = useState<TagNode | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addModal = useModal({ urlKey: 'add' });
  const editModal = useUrlValueModal('edit');
  const { id: highlightTagId, flash } = useRowHighlight<number>();

  useEffect(() => {
    void (async () => {
      try {
        setConstants(await fetchTagConstants());
      } catch (err) {
        console.error('Failed to load constants', err);
      }
    })();
  }, []);

  // Sync editingTag with the URL value so reload-on-?edit=<id> reopens.
  useEffect(() => {
    if (!editModal.value) {
      setEditingTag(null);
      return;
    }
    const tid = parseInt(editModal.value, 10);
    const tag = flatTagsToNodes(flatTags, tid, tags);
    setEditingTag(tag);
  }, [editModal.value, flatTags, tags]);

  function handleEdit(tag: TagNode) {
    setError(null);
    editModal.openWith(String(tag.tag_id));
  }

  async function handleConfirmDelete() {
    if (!deletingTag) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteTagRequest(deletingTag.tag_id);
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
      setDeletingTag(null);
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to delete tag');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaved(saved?: CreatedTag) {
    await queryClient.invalidateQueries({ queryKey: tagKeys.all });
    if (saved?.tag_id != null) flash(saved.tag_id);
  }

  const isSystemEditingTag = useMemo(() => {
    if (!editingTag) return false;
    return (
      editingTag.created_by === null ||
      editingTag.created_by === constants?.SYSTEM_USER_ID
    );
  }, [editingTag, constants]);

  // Card-anchored layout (Batch 9 polish): the page is mounted under
  // the SettingsLayout shell, which provides outer gutter + breadcrumb
  // ("Settings › Categories") + sidebar. The page itself renders just
  // its card so the card's top edge aligns with the sidebar's first
  // NavLink top edge. No in-content title, no Back-to-dashboard link
  // (the top-nav Home icon + Brand link cover both).
  return (
    <>
      <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            All tags
          </h2>
          <button
            type="button"
            onClick={addModal.open}
            className="btn-primary !w-auto"
          >
            Add Tag
          </button>
        </div>

        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          System tags (seeded defaults) can only be partially edited (aliases
          and tag types). Custom categories and subcategories can be added
          below.{' '}
          <strong className="text-slate-700 dark:text-slate-200">
            Aliases help the auto-categorization engine to tag your transactions
            correctly.
          </strong>
        </p>

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
              constants={constants}
              highlightTagId={highlightTagId}
            />
          )}
        </div>
      </section>

      <TagFormDialog
        open={addModal.isOpen}
        onClose={addModal.close}
        onSaved={handleSaved}
        flatTags={flatTags}
      />
      <TagFormDialog
        open={editModal.isOpen && !!editingTag}
        onClose={editModal.close}
        onSaved={handleSaved}
        editingTag={editingTag}
        isSystemTag={isSystemEditingTag}
        flatTags={flatTags}
        onRequestRemove={
          editingTag ? () => setDeletingTag(editingTag) : undefined
        }
      />
      <ConfirmDialog
        open={deletingTag != null}
        onClose={() => setDeletingTag(null)}
        onConfirm={async () => {
          await handleConfirmDelete();
          // Close the edit modal if the delete was triggered from inside
          // it (Remove-in-header convention). Row-button deletes already
          // closed cleanly; the modal-Trash path needs the explicit
          // dismiss so the user doesn't see a "Tag not found" state.
          editModal.close();
        }}
        title="Delete tag"
        message={
          deletingTag
            ? `Delete tag "${deletingTag.tag_name}"? Existing transactions retain their tag history.`
            : ''
        }
        confirmLabel="Delete"
        intent="danger"
        busy={deleting}
      />
    </>
  );
}

// Walk the (already-sorted) tag tree to find a TagNode by id. The
// edit-modal needs the full node (including `created_by`) — flatTags
// alone is enough but we keep the parent chain intact for completeness.
function flatTagsToNodes(
  flat: FlatTag[],
  id: number,
  tree: TagNode[]
): TagNode | null {
  const flatHit = flat.find((t) => t.tag_id === id);
  if (!flatHit) return null;
  // Recover the matching tree node so caller has access to children.
  function find(nodes: TagNode[]): TagNode | null {
    for (const n of nodes) {
      if (n.tag_id === id) return n;
      const sub = find(n.children ?? []);
      if (sub) return sub;
    }
    return null;
  }
  return find(tree);
}
