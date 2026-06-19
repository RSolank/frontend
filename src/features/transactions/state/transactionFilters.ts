import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// URL-state hook for every Transactions-page filter. Single source of
// truth — the page reads from this, writes through this, and the URL
// is always authoritative.
//
// `view` covers the 3-pill primary view toggle (list / merchant /
// calendar) and supersedes the old useTransactionViewStore. The store
// is dropped because URL state already survives reloads, syncs across
// tabs, and is shareable — the Zustand persist layer was redundant.
//
// `?view=list|merchant|calendar` — primary view mode.
// `?type=debit|credit`           — debit/credit filter.
// `?tag=<id>`                    — tag filter.
// `?month=<YYYY-MM>`             — selected month (list + merchant).
// `?beneficiary=<id>`            — beneficiary filter.
// `?sort=<field>&order=asc|desc` — sort spec.
// `?day=<YYYY-MM-DD>`            — calendar day flyout (consumed by
//                                  useUrlValueModal('day')).
// `?add=true`, `?edit=<id>`      — modal state (existing).

// Filter-patch keys whose URL param name differs from the API field name.
// The read side reads `beneficiary`/`sort`; the write side must mirror it.
const URL_KEY_OVERRIDES: Record<string, string> = {
  beneficiaryId: 'beneficiary',
  sortBy: 'sort',
};

export type TransactionView = 'list' | 'merchant' | 'calendar';
export type TypeFilter = 'all' | 'debit' | 'credit';
// BE Phase 1.7 contract: backend accepts `date | amount | total_count |
// net_expense | name`. (Old `frequency` / `total_amount` were renamed
// to `total_count` / `net_expense` as part of T-aggregates-engine.)
export type SortField =
  | 'date'
  | 'amount'
  | 'total_count'
  | 'net_expense'
  | 'name';
export type SortOrder = 'asc' | 'desc';

export interface TransactionFilters {
  view: TransactionView;
  type: TypeFilter;
  tag: string;
  month: string;
  beneficiaryId: string;
  sortBy: SortField;
  order: SortOrder;
}

interface FilterUpdate {
  view?: TransactionView;
  type?: TypeFilter;
  tag?: string;
  month?: string;
  beneficiaryId?: string;
  sortBy?: SortField;
  order?: SortOrder;
}

export interface UseTransactionFiltersReturn extends TransactionFilters {
  /** Update one or more filters; passes through to the URL. */
  set: (patch: FilterUpdate) => void;
  /** Reset everything except the view + month + beneficiary (the
   *  always-visible row-2 controls); reflects the "Clear all" affordance
   *  in the FilterSidebar footer. */
  clearAll: () => void;
  /** Count of non-default filters inside the sidebar — drives the
   *  "(n)" badge on the filter icon. */
  sidebarActiveCount: number;
}

function defaultSortForView(view: TransactionView): {
  sortBy: SortField;
  order: SortOrder;
} {
  if (view === 'merchant') return { sortBy: 'net_expense', order: 'desc' };
  return { sortBy: 'date', order: 'desc' };
}

function parseView(raw: string | null): TransactionView {
  if (raw === 'merchant' || raw === 'calendar') return raw;
  return 'list';
}

function parseType(raw: string | null): TypeFilter {
  if (raw === 'debit' || raw === 'credit') return raw;
  return 'all';
}

function parseSortField(raw: string | null): SortField | null {
  if (
    raw === 'date' ||
    raw === 'amount' ||
    raw === 'total_count' ||
    raw === 'net_expense' ||
    raw === 'name'
  ) {
    return raw;
  }
  return null;
}

function parseOrder(raw: string | null): SortOrder | null {
  if (raw === 'asc' || raw === 'desc') return raw;
  return null;
}

export function useTransactionFilters(): UseTransactionFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = parseView(searchParams.get('view'));
  const type = parseType(searchParams.get('type'));
  const tag = searchParams.get('tag') ?? '';
  const month = searchParams.get('month') ?? '';
  const beneficiaryId = searchParams.get('beneficiary') ?? '';
  // Sort defaults vary by view (merchant view defaults to net_expense).
  // When the user explicitly sets a sort, the URL carries it; otherwise
  // we synthesise the default at read time so the parsed value reflects
  // what the query would actually use.
  const sortFromUrl = parseSortField(searchParams.get('sort'));
  const orderFromUrl = parseOrder(searchParams.get('order'));
  const fallback = defaultSortForView(view);
  const sortBy = sortFromUrl ?? fallback.sortBy;
  const order = orderFromUrl ?? fallback.order;

  const set = useCallback(
    (patch: FilterUpdate) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        // URL-key remap: the filter API uses `beneficiaryId`/`sortBy`, but the
        // URL (and the read side above) carry `beneficiary`/`sort`. Keep these
        // in sync or a sort selection writes `?sortBy=` while the reader looks
        // for `?sort=` and silently falls back to the view default.
        const urlKey = URL_KEY_OVERRIDES[key] ?? key;
        if (value == null || value === '' || value === 'all') {
          next.delete(urlKey);
        } else {
          next.set(urlKey, String(value));
        }
      }
      // Resetting the view also resets the sort to the default for that
      // view (so switching to Merchant lands on net_expense-desc, not
      // a stale date-desc inherited from List).
      if (patch.view) {
        const def = defaultSortForView(patch.view);
        if (patch.sortBy == null) next.delete('sort');
        if (patch.order == null) next.delete('order');
        // Default already applied via the read-side fallback; we just
        // drop the URL keys so the next sort change is clean.
        void def;
      }
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    // Only sidebar-controlled keys: type / tag / sort / order. Month
    // and beneficiary are top-level controls; user clears them
    // explicitly via the dedicated input.
    next.delete('type');
    next.delete('tag');
    next.delete('sort');
    next.delete('order');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  const sidebarActiveCount = useMemo(() => {
    let n = 0;
    if (type !== 'all') n += 1;
    if (tag !== '') n += 1;
    const def = defaultSortForView(view);
    if (sortBy !== def.sortBy || order !== def.order) n += 1;
    return n;
  }, [type, tag, sortBy, order, view]);

  return {
    view,
    type,
    tag,
    month,
    beneficiaryId,
    sortBy,
    order,
    set,
    clearAll,
    sidebarActiveCount,
  };
}
