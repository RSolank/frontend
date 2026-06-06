import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownAZ, ArrowUpAZ, X } from 'lucide-react';
import { useMemo } from 'react';

import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import type { TagNode } from '../../tags/api/queries';
import type {
  SortField,
  SortOrder,
  TransactionView,
  TypeFilter,
} from '../state/transactionFilters';

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

// Type-toggle button label — if/else (not a nested ternary) so it stays off
// sonarjs/no-nested-conditional.
function typeLabel(t: TypeFilter): string {
  if (t === 'all') return 'All';
  if (t === 'debit') return 'Debit';
  return 'Credit';
}

interface FilterSidebarProps {
  open: boolean;
  onClose: () => void;
  view: TransactionView;
  type: TypeFilter;
  tag: string;
  sortBy: SortField;
  order: SortOrder;
  tags: FlatTag[];
  onTypeChange: (next: TypeFilter) => void;
  onTagChange: (next: string) => void;
  onSortByChange: (next: SortField) => void;
  onOrderChange: (next: SortOrder) => void;
  onClearAll: () => void;
}

// Right-edge slide-in panel for the Transactions page filters. Type +
// Sort live here permanently; Tag lives here too. The main filter bar
// retains Month + Merchant search; everything else is one click away.
//
// Built on Radix Dialog primitives directly (matches DaySidePanel's
// pattern). See CONTRIBUTING.md §6 + the Batch 9.6 docs for the
// rationale.
export function FilterSidebar({
  open,
  onClose,
  view,
  type,
  tag,
  sortBy,
  order,
  tags,
  onTypeChange,
  onTagChange,
  onSortByChange,
  onOrderChange,
  onClearAll,
}: FilterSidebarProps) {
  const showTypeFilter = view !== 'calendar';
  const showSort = view !== 'calendar';

  // Build the tag options once per render — empty value is the
  // "All tags" no-filter state, pinned at the top.
  const tagOptions = useMemo(
    () => [
      { value: '', label: 'All tags' },
      ...tags.map((t) => ({ value: String(t.tag_id), label: t.tag_name })),
    ],
    [tags]
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] w-full flex-col rounded-t-xl bg-white shadow-xl outline-none sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:h-full sm:max-h-none sm:max-w-sm sm:rounded-none sm:rounded-l-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Filters
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close filters"
                className="focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X aria-hidden size={18} />
              </button>
            </Dialog.Close>
          </header>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            {showTypeFilter && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Type
                </h3>
                <div className="inline-flex rounded-md bg-slate-100 p-1 dark:bg-slate-800">
                  {(['all', 'debit', 'credit'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={type === t}
                      onClick={() => onTypeChange(t)}
                      className={`flex-1 rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                        type === t
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                      }`}
                    >
                      {typeLabel(t)}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-2">
              <label
                htmlFor="filter-tag"
                className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
              >
                Tag
              </label>
              {/* Typeahead per the project "Searchable dropdowns"
                  convention — tags can easily exceed 15 items for a
                  real user, and a flat <select> becomes painful at
                  that size. See CONTRIBUTING.md §6 "Searchable
                  dropdowns". */}
              <SearchableSelect
                id="filter-tag"
                ariaLabel="Filter by tag"
                placeholder="All tags"
                value={tag}
                options={tagOptions}
                onChange={onTagChange}
              />
            </section>

            {showSort && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Sort
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Sort by"
                    value={sortBy}
                    onChange={(e) =>
                      onSortByChange(e.target.value as SortField)
                    }
                    className="form-input flex-1"
                  >
                    {view === 'merchant' ? (
                      <>
                        <option value="net_expense">Total spend</option>
                        <option value="total_count">Total transactions</option>
                      </>
                    ) : (
                      <>
                        <option value="date">Date</option>
                        <option value="amount">Amount</option>
                      </>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      onOrderChange(order === 'asc' ? 'desc' : 'asc')
                    }
                    aria-label={
                      order === 'asc'
                        ? 'Currently ascending — switch to descending'
                        : 'Currently descending — switch to ascending'
                    }
                    title={order === 'asc' ? 'Ascending' : 'Descending'}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {order === 'asc' ? (
                      <ArrowUpAZ aria-hidden size={18} />
                    ) : (
                      <ArrowDownAZ aria-hidden size={18} />
                    )}
                  </button>
                </div>
              </section>
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClearAll}
              className="text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 text-sm font-semibold"
            >
              Clear all
            </button>
            <Dialog.Close asChild>
              <button type="button" className="btn-primary !w-auto !py-2">
                Done
              </button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Re-export the TagNode flat helper type so consumers don't have to
// rebuild it.
export type { FlatTag };
export type { TagNode };
