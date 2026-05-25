import { useState } from 'react';

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

interface TagSelectorProps {
  tags: FlatTag[];
  selectedTagIds: number[];
  miscellaneousTagId?: number;
  totalTagId?: number;
  onAdd: (tagId: number) => void;
  onRemove: (tagId: number) => void;
}

// Shared by Add + Edit transaction. Owns the search input + dropdown +
// chip rail. The miscellaneous-tag rule (if any non-misc tag is
// present, misc is dropped; if no tags remain, misc is re-added) lives
// in the parent's `onAdd` / `onRemove` since they also own the form
// state. This component is dumb — it just emits intents.
export function TagSelector({
  tags,
  selectedTagIds,
  miscellaneousTagId,
  totalTagId,
  onAdd,
  onRemove,
}: TagSelectorProps) {
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);

  const available = tags.filter((t) => {
    if (selectedTagIds.includes(t.tag_id)) return false;
    if (t.tag_id === totalTagId) return false;
    if (
      miscellaneousTagId &&
      t.tag_id === miscellaneousTagId &&
      selectedTagIds.some((id) => id !== miscellaneousTagId)
    ) {
      return false;
    }
    return (
      !search || t.tag_name.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div>
      <label htmlFor="tags_search" className="form-label">
        Tags
      </label>
      <div className="relative">
        <input
          id="tags_search"
          type="text"
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          className="form-input"
          autoComplete="off"
        />
        {focused && available.length > 0 && (
          <div className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
            {available.map((t) => (
              <button
                key={t.tag_id}
                type="button"
                onMouseDown={() => {
                  onAdd(t.tag_id);
                  setSearch('');
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t.tag_name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {selectedTagIds.map((tid) => {
          const tag = tags.find((tg) => tg.tag_id === tid);
          return (
            <span
              key={tid}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              {tag?.tag_name ?? `Tag ${tid}`}
              <button
                type="button"
                aria-label={`Remove ${tag?.tag_name ?? tid}`}
                onClick={() => onRemove(tid)}
                className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
