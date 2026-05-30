import { useEffect, useMemo, useState } from 'react';

import { usePreferencesStore } from '../../../../shared/state/preferences.store';
import { formatDate } from '../../../../shared/utils/dateUtils';
import type { ProblematicTxn } from '../../api/schemas';

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

interface ProblematicTxnRowProps {
  txn: ProblematicTxn;
  tags: FlatTag[];
  saved: boolean;
  onSaveTags: (txnId: number, tagIds: number[]) => void;
}

// Per-row categorize panel used in the upload review step. Lets the
// user tag a transaction the categorization engine couldn't auto-tag.
// Keyboard nav (↑ / ↓ / Enter / Esc) is preserved from the legacy
// component — statement uploads can have many problematic rows and
// mousing through every one is painful.
export function ProblematicTxnRow({
  txn,
  tags,
  saved,
  onSaveTags,
}: ProblematicTxnRowProps) {
  const timezone = usePreferencesStore((s) => s.timezone);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);
  const [activeTagIndex, setActiveTagIndex] = useState(-1);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const availableTags = useMemo(() => {
    return tags.filter(
      (t) =>
        !selectedTagIds.includes(t.tag_id) &&
        (!tagSearch ||
          t.tag_name.toLowerCase().includes(tagSearch.toLowerCase()))
    );
  }, [tags, selectedTagIds, tagSearch]);

  useEffect(() => {
    // If the user already saved, mirror the backend-stored tag_ids so
    // the chip row reflects what's actually persisted.
    if (
      saved &&
      selectedTagIds.length === 0 &&
      txn.tag_ids &&
      txn.tag_ids.length
    ) {
      setSelectedTagIds(txn.tag_ids);
    }
    // selectedTagIds intentionally omitted — we only want this to fire
    // when `saved` flips true; including it would clobber user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  function handleAddTag(id: number) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setTagSearch('');
    setActiveTagIndex(-1);
  }

  function handleToggleTag(id: number) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3">
        <div className="font-semibold text-slate-900 dark:text-slate-100">
          {txn.beneficiary || '—'}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(txn.txn_date, timezone)} • {txn.debit_credit} •{' '}
          {txn.amount}
        </div>
      </div>

      <div className="mb-3">
        <label
          htmlFor={`tag-search-${txn.txn_id}`}
          className="form-label"
        >
          Categorize
        </label>
        <input
          id={`tag-search-${txn.txn_id}`}
          type="text"
          placeholder="Search tags..."
          value={tagSearch}
          onChange={(e) => {
            setTagSearch(e.target.value);
            setActiveTagIndex(0);
          }}
          onFocus={() => {
            setTagSearchFocused(true);
            if (availableTags.length > 0) setActiveTagIndex(0);
          }}
          onBlur={() => {
            setTimeout(() => {
              setTagSearchFocused(false);
              setActiveTagIndex(-1);
            }, 120);
          }}
          onKeyDown={(e) => {
            if (!availableTags.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveTagIndex((idx) =>
                idx < availableTags.length - 1 ? idx + 1 : 0
              );
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveTagIndex((idx) =>
                idx > 0 ? idx - 1 : availableTags.length - 1
              );
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const chosen =
                availableTags[activeTagIndex] ?? availableTags[0];
              if (chosen) handleAddTag(chosen.tag_id);
            } else if (e.key === 'Escape') {
              setTagSearch('');
              setTagSearchFocused(false);
              setActiveTagIndex(-1);
            }
          }}
          className="form-input"
          autoComplete="off"
        />

        {tagSearchFocused && tagSearch && availableTags.length > 0 && (
          <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {availableTags.slice(0, 10).map((t, i) => (
              <button
                key={t.tag_id}
                type="button"
                onClick={() => handleAddTag(t.tag_id)}
                onMouseEnter={() => setActiveTagIndex(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === activeTagIndex
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {t.tag_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTagIds.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-3">
          {selectedTagIds.map((id) => {
            const t = tags.find((x) => x.tag_id === id);
            return (
              <label
                key={id}
                className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => handleToggleTag(id)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {t?.tag_name || id}
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onSaveTags(txn.txn_id, selectedTagIds)}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {saved ? 'Saved' : 'Save tags'}
        </button>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          If you save with no tags, this row is marked as Miscellaneous.
        </div>
      </div>
    </div>
  );
}
