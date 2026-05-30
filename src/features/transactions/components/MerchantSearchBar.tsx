import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';

interface MerchantSearchBarProps {
  // Active beneficiary id filter — empty string means no filter.
  beneficiaryId: string;
  onChange: (next: string) => void;
}

// Option-row styling by highlight / selection state — if/else (not a nested
// ternary) so it reads cleanly and stays off sonarjs/no-nested-conditional.
function optionClass(isHighlighted: boolean, isSelected: boolean): string {
  const base = 'block w-full px-3 py-2 text-left text-sm ';
  if (isHighlighted)
    return `${base}bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100`;
  if (isSelected)
    return `${base}bg-indigo-50 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200`;
  return `${base}text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800`;
}

// Compact, label-less beneficiary typeahead living in the
// Transactions page filter bar. Selecting a beneficiary sets the
// `?beneficiary=<id>` URL filter; backend's `beneficiary_id` query
// param handles the server-side filtering. Clearing the input drops
// the filter.
//
// Keyboard nav: ↑/↓ moves the highlight, Enter selects, Escape
// closes. Click + hover update the highlight too so the two
// interaction modes don't fight.
export function MerchantSearchBar({
  beneficiaryId,
  onChange,
}: MerchantSearchBarProps) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load beneficiaries once on mount.
  useEffect(() => {
    let cancelled = false;
    fetchBeneficiaries()
      .then((list) => {
        if (!cancelled) setBeneficiaries(list);
      })
      .catch(() => {
        // Soft fail — empty list disables the typeahead, page still
        // works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync the visible value with the selected beneficiary id (so
  // navigating in via URL state shows the name without the user
  // having to retype).
  useEffect(() => {
    if (!beneficiaryId) {
      setDraft('');
      return;
    }
    const match = beneficiaries.find((b) => String(b.uid) === beneficiaryId);
    if (match) setDraft(match.name);
  }, [beneficiaryId, beneficiaries]);

  // Close the dropdown on click-outside.
  useEffect(() => {
    if (!focused) return undefined;
    function handleClick(e: MouseEvent) {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [focused]);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return beneficiaries.slice(0, 20);
    return beneficiaries
      .filter((b) => b.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [draft, beneficiaries]);

  // Reset highlight whenever the filtered list shape changes so
  // arrow-nav always starts at the top after typing.
  useEffect(() => {
    setHighlightIdx(0);
  }, [draft, filtered.length]);

  // Scroll the highlighted item into view when arrow-nav walks past
  // the visible window.
  useEffect(() => {
    if (!focused || filtered.length === 0) return;
    const list = listRef.current;
    if (!list) return;
    const child = list.children[highlightIdx] as HTMLElement | undefined;
    if (child) child.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, focused, filtered.length]);

  function pick(b: Beneficiary) {
    onChange(String(b.uid));
    setDraft(b.name);
    setFocused(false);
  }

  function clear() {
    onChange('');
    setDraft('');
    setFocused(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused(true);
      if (filtered.length === 0) return;
      setHighlightIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused(true);
      if (filtered.length === 0) return;
      setHighlightIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      if (!focused || filtered.length === 0) return;
      e.preventDefault();
      const b = filtered[highlightIdx];
      if (b) pick(b);
    } else if (e.key === 'Escape') {
      if (!focused) return;
      e.preventDefault();
      setFocused(false);
    }
  }

  const activeId =
    focused && filtered[highlightIdx]
      ? `merchant-option-${filtered[highlightIdx]!.uid}`
      : undefined;

  return (
    <div ref={ref} className="relative w-full sm:w-64">
      <div className="relative">
        <Search
          aria-hidden
          size={16}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Typing without selecting clears the active id filter so
            // the dropdown doesn't lie about state.
            if (beneficiaryId) onChange('');
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search merchant…"
          aria-label="Search merchant"
          autoComplete="off"
          role="combobox"
          aria-expanded={focused}
          aria-controls="merchant-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          className="form-input !pl-8 !pr-8"
        />
        {(draft || beneficiaryId) && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear merchant filter"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X aria-hidden size={14} />
          </button>
        )}
      </div>
      {focused && filtered.length > 0 && (
        <div
          ref={listRef}
          id="merchant-search-listbox"
          role="listbox"
          className="absolute right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          {filtered.map((b, idx) => {
            const isHighlighted = idx === highlightIdx;
            const isSelected = String(b.uid) === beneficiaryId;
            return (
              <button
                key={b.uid}
                id={`merchant-option-${b.uid}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={() => pick(b)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={optionClass(isHighlighted, isSelected)}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}
      {focused && filtered.length === 0 && (
        <div className="absolute right-0 left-0 z-20 mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
          No matches
        </div>
      )}
    </div>
  );
}
