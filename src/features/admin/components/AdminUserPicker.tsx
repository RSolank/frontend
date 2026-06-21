import { useState } from 'react';

import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useAdminUsersInfiniteQuery, type AdminUserRow } from '../api/users';

// Server-driven typeahead user picker. Built locally for the admin
// bill-backfill form (D1) — SearchableSelect requires a pre-loaded
// options array, but the user list is paginated server-side and
// arbitrarily large. Reuses the existing A2 endpoint via
// `useAdminUsersInfiniteQuery` so the debounce + <=2-char gate + 25-
// row limit are inherited.
//
// Deliberate carve-out from the shared typeahead family
// (T-typeahead-consolidation): async server-search + the selected-user
// card (with "Change") is a distinct pattern. Folding it would push
// debounce / min-char / loading-state concerns into the shared
// SearchableSelect (8 pick-only consumers) for a single admin screen —
// not worth the added surface. See docs/conventions.md §6.

interface AdminUserPickerProps {
  // The selected user (the chosen row). Lifting up keeps the form
  // owner in control of what gets submitted; the picker is stateless
  // wrt selection.
  value: AdminUserRow | null;
  onChange: (next: AdminUserRow | null) => void;
  enabled?: boolean;
}

export function AdminUserPicker({
  value,
  onChange,
  enabled = true,
}: AdminUserPickerProps) {
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebouncedValue(rawQuery, 300);
  const [open, setOpen] = useState(false);

  // First page is enough — operator picks one of the top matches.
  // Load-more isn't worth threading through for a picker.
  const { data, isFetching } = useAdminUsersInfiniteQuery(
    { q: debouncedQuery, include_deleted: false },
    enabled && value === null
  );
  const rows = (data?.pages[0]?.users ?? []).slice(0, 10);

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="font-medium text-slate-800 dark:text-slate-200">
          {value.full_name}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          ({value.email})
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setRawQuery('');
          }}
          className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 ml-auto text-xs font-medium"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        aria-label="Search target user by email or name"
        placeholder="Search by email or name (3+ chars)…"
        value={rawQuery}
        onChange={(e) => {
          setRawQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Defer close so list-item onMouseDown can fire first.
          setTimeout(() => setOpen(false), 100);
        }}
        className="form-input"
        disabled={!enabled}
      />
      {open && debouncedQuery.length > 2 ? (
        <ul
          role="listbox"
          aria-label="Matching users"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          {isFetching && rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              Searching…
            </li>
          ) : null}
          {!isFetching && rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              No users match &ldquo;{debouncedQuery}&rdquo;.
            </li>
          ) : null}
          {rows.map((row) => (
            <li key={row.user_id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  // Prevent the input's blur from firing first and
                  // closing the list before the click is recorded.
                  e.preventDefault();
                }}
                onClick={() => {
                  onChange(row);
                  setOpen(false);
                  setRawQuery('');
                }}
                className="hover:bg-accent-50/60 dark:hover:bg-accent-950/30 flex w-full flex-col items-start px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {row.full_name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {row.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
