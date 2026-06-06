import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  FileUp,
  List as ListIcon,
  SlidersHorizontal,
  Store,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useCapabilities } from '../../../shared/api/capabilities';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { Modal } from '../../../shared/components/Modal';
import { useIntersectionObserver } from '../../../shared/hooks/useIntersectionObserver';
import { useModal, useUrlValueModal } from '../../../shared/hooks/useModal';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatYearMonth } from '../../../shared/utils/dateUtils';
import { useTagsQuery, type TagNode } from '../../tags/api/queries';
import { monthKeyFromIso, todayIsoInTz } from '../api/calendar';
import { transactionKeys, type TransactionListParams } from '../api/keys';
import { deleteTransactionRequest } from '../api/mutations';
import {
  useInfiniteTransactionsQuery,
  useTransactionsQuery,
} from '../api/queries';
import type { MerchantGroup, TransactionDTO } from '../api/schemas';
import { CalendarView } from '../components/CalendarView';
import { DaySidePanel } from '../components/DaySidePanel';
import { FilterSidebar } from '../components/FilterSidebar';
import { MerchantRow } from '../components/MerchantRow';
import { MerchantSearchBar } from '../components/MerchantSearchBar';
import { MonthDropdown } from '../components/MonthDropdown';
import { TransactionRow } from '../components/TransactionRow';
import {
  useTransactionFilters,
  type TransactionView,
} from '../state/transactionFilters';

import { AddTransactionPage } from './AddTransactionPage';
import { EditTransactionPage } from './EditTransactionPage';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

function flattenTags(
  nodes: TagNode[] | undefined,
  out: FlatTag[] = []
): FlatTag[] {
  for (const n of nodes ?? []) {
    out.push({ tag_id: n.tag_id, tag_name: n.tag_name });
    flattenTags(n.children, out);
  }
  return out;
}

// "3 transactions" / "1 merchant" — pluralise without a nested ternary at the
// call site (keeps the count label off sonarjs/no-nested-conditional).
function pluralCount(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

// Merchant view scope copy — BE 2026-06-06 grouped reads carry the
// active window on every page. Three cases:
//   - 'all'      → no window param sent → all-time aggregate
//                  (new default, surfaces backdated imports).
//   - 'monthly'  → period_start = YYYY-MM-DD; render as "Feb 2026".
//   - 'weekly'   → period_start = YYYY-MM-DD (Mon); render as
//                  "Feb 9 → Feb 15" using ISO Mon→Sun convention.
// Anything else falls back to a copy of the raw period_type so future
// BE additions still render something readable instead of `[object]`.
function scopePillCopy(periodType: string, periodStart: string | null): string {
  if (periodType === 'all') return 'All time';
  if (periodType === 'monthly' && periodStart) {
    return formatYearMonth(periodStart.slice(0, 7), 'short');
  }
  if (periodType === 'weekly' && periodStart) {
    const start = new Date(`${periodStart}T00:00:00Z`);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const f = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    return `${f.format(start)} → ${f.format(end)}`;
  }
  return periodType;
}

// Merchant empty-state copy — scope-aware. Old "No merchants found."
// was ambiguous (was it "no data ever" or "no data this month?"). The
// new copy folds the active window into the message so the user
// knows exactly which scope is empty.
function merchantEmptyCopy(
  periodType: string | null,
  scopeLabel: string | null
): string {
  if (periodType === 'all') return 'No merchants across your history yet.';
  if (scopeLabel) return `No merchants for ${scopeLabel}.`;
  return 'No merchants found.';
}

// Resolve the banner message from the delete error + the active query error.
// if/else cascade (not the previous nested-ternary chain). `hasError` is the
// truthiness of the active query error, kept separate so a non-string error
// object still surfaces the generic fallback.
function resolveErrorMessage(
  deleteError: string | null,
  errorObj: ApiErrorShape | null,
  hasError: boolean
): string | null {
  if (deleteError) return deleteError;
  if (typeof errorObj?.detail === 'string') return errorObj.detail;
  if (typeof errorObj?.error === 'string') return errorObj.error;
  if (hasError) return 'Failed to load data';
  return null;
}

const PAGE_SIZE = 25;
// Calendar's per-month fetch — backend caps `limit` at 100. Realistic
// personal-budget months stay well under; if a month tail truncates,
// pagination would be the fix.
const CALENDAR_FETCH_LIMIT = 100;

const VIEW_TABS: Array<{
  value: TransactionView;
  label: string;
  icon: typeof ListIcon;
}> = [
  { value: 'list', label: 'List', icon: ListIcon },
  { value: 'merchant', label: 'Merchant', icon: Store },
  { value: 'calendar', label: 'Calendar', icon: CalendarIcon },
];

// eslint-disable-next-line max-lines-per-function -- the toolbar, list body and render branches are extracted to <TransactionsToolbar>/<TransactionListBody> + helpers; the residual is the page's query/derived-state wiring (four queries + their memoised slices + modal state) plus a flat modal-mount block. Hoisting that into a hook would add indirection without reducing real complexity (cx is already ~7 here).
export function TransactionsPage() {
  const queryClient = useQueryClient();
  const timezone = usePreferencesStore((s) => s.timezone);
  const { currencyCode, currencySymbol } = useMoneyFormatter();
  const { data: tagsData } = useTagsQuery();
  const tags = useMemo(() => flattenTags(tagsData?.tags), [tagsData?.tags]);

  const filters = useTransactionFilters();
  const {
    view,
    type,
    tag,
    month,
    beneficiaryId,
    sortBy,
    order,
    set,
    clearAll,
  } = filters;
  const isCalendar = view === 'calendar';
  const isMerchant = view === 'merchant';

  // Modal + side-panel state.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addModalDefaultDate, setAddModalDefaultDate] = useState<string | null>(
    null
  );
  const addModal = useModal({ urlKey: 'add' });
  const editModal = useUrlValueModal('edit');
  const dayPanel = useUrlValueModal('day');
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const { id: highlightTxnId, flash } = useRowHighlight<number>();

  // Calendar's own month-anchor / week-anchor state — independent of
  // the page filter `month`, since the calendar lets the user step
  // through months without changing the dropdown.
  const [calendarMonthKey, setCalendarMonthKey] = useState<string>(() =>
    monthKeyFromIso(todayIsoInTz(timezone))
  );
  const [calendarWeekAnchor, setCalendarWeekAnchor] = useState<string>(() =>
    todayIsoInTz(timezone)
  );
  const [calendarFocusedIso, setCalendarFocusedIso] = useState<string | null>(
    null
  );

  // List + Merchant view share the infinite-query — params include
  // the active filters from the URL state. Calendar uses its own
  // bounded month-only query (CalendarView consumes raw txns).
  const listParams: Omit<TransactionListParams, 'offset'> = useMemo(
    () => ({
      limit: PAGE_SIZE,
      ...(type !== 'all' ? { debit_credit: type } : {}),
      ...(isMerchant ? { group_by: 'merchant' as const } : {}),
      sort_by: sortBy,
      order,
      ...(tag ? { tag_id: tag } : {}),
      ...(month ? { month } : {}),
      ...(beneficiaryId ? { beneficiary_id: beneficiaryId } : {}),
    }),
    [type, isMerchant, sortBy, order, tag, month, beneficiaryId]
  );

  const {
    data: infiniteData,
    isLoading: listLoading,
    error: listError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTransactionsQuery(listParams);

  // Memoised so the flatMap slices below don't see a fresh `[]` identity on
  // every render when there are no pages yet.
  const accumulatedPages = useMemo(
    () => infiniteData?.pages ?? [],
    [infiniteData?.pages]
  );
  const transactions: TransactionDTO[] = useMemo(
    () => accumulatedPages.flatMap((p) => p.transactions ?? []),
    [accumulatedPages]
  );
  const groups = useMemo(
    () => accumulatedPages.flatMap((p) => p.groups ?? []),
    [accumulatedPages]
  );
  // BE 2026-06-06 — grouped reads carry the active window on every
  // page. All pages of the same query share the same window, so take
  // it from the first page. Drives the scope pill + empty-state copy
  // below; both null until the first page lands. Bundled into one
  // memo so the complexity gate sees a single derived value.
  const groupedPeriod = useMemo(
    () => ({
      type: accumulatedPages[0]?.period_type ?? null,
      start: accumulatedPages[0]?.period_start ?? null,
    }),
    [accumulatedPages]
  );

  // IntersectionObserver-driven auto-load on desktop. Sentinel is
  // hidden on mobile (display:none → no intersection events fire),
  // so the desktop / mobile divide is purely CSS — no JS sniffing.
  const sentinelRef = useIntersectionObserver({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
    enabled: !isCalendar && Boolean(hasNextPage),
  });

  // Calendar mode pulls the displayed month with no debit/credit
  // filter or pagination — page filters DO bleed into the calendar
  // when they make sense (tag + beneficiary), but type stays
  // ignored (cells already show both signs).
  const calendarParams: TransactionListParams = useMemo(
    () => ({
      limit: CALENDAR_FETCH_LIMIT,
      offset: 0,
      month: calendarMonthKey,
      sort_by: 'date',
      order: 'desc',
      ...(tag ? { tag_id: tag } : {}),
      ...(beneficiaryId ? { beneficiary_id: beneficiaryId } : {}),
    }),
    [calendarMonthKey, tag, beneficiaryId]
  );
  const {
    data: calendarData,
    isLoading: calendarLoading,
    error: calendarError,
  } = useTransactionsQuery(calendarParams);
  const calendarTxns: TransactionDTO[] = useMemo(
    () => calendarData?.transactions ?? [],
    [calendarData?.transactions]
  );

  // Day-flyout data slice — reuse the calendar's month query when the
  // selected day falls inside the current calendar month, otherwise
  // fetch the day's month separately. Same de-dup trick from 9.6.
  const dayMonthKey = dayPanel.value
    ? dayPanel.value.slice(0, 7)
    : calendarMonthKey;
  const dayParams: TransactionListParams = useMemo(
    () => ({
      limit: CALENDAR_FETCH_LIMIT,
      offset: 0,
      month: dayMonthKey,
      sort_by: 'date',
      order: 'desc',
    }),
    [dayMonthKey]
  );
  const sameMonth = dayMonthKey === calendarMonthKey;
  const { data: dayData } = useTransactionsQuery(dayParams);
  const dayTxnsAll = useMemo(
    () => (sameMonth ? calendarTxns : (dayData?.transactions ?? [])),
    [sameMonth, calendarTxns, dayData?.transactions]
  );
  const dayTxns = useMemo(() => {
    if (!dayPanel.value) return [];
    return dayTxnsAll.filter((t) => {
      const raw = t.txn_date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw === dayPanel.value;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      const iso = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
      return iso === dayPanel.value;
    });
  }, [dayPanel.value, dayTxnsAll, timezone]);

  // Editing-txn lookup for the modal-header Remove gate.
  const editingTxn: TransactionDTO | null = useMemo(() => {
    if (editModal.value == null) return null;
    const id = Number(editModal.value);
    return transactions.find((t) => t.txn_id === id) ?? null;
  }, [editModal.value, transactions]);
  const editingIsManual = editingTxn?.source === 'manual';

  function handleEdit(id: number) {
    editModal.openWith(String(id));
  }
  async function handleConfirmDelete() {
    if (confirmDeleteId == null) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteTransactionRequest(confirmDeleteId);
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      setConfirmDeleteId(null);
      editModal.close();
    } catch (err) {
      const e = err as ApiErrorShape;
      setDeleteError(e.detail || e.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  function showMerchantTransactions(beneficiaryUid: number) {
    set({ view: 'list', beneficiaryId: String(beneficiaryUid) });
  }

  // Defensive error string — never let an unexpected object flow into
  // JSX as a child (post-Batch-9.6 hardening).
  const activeError = (
    isCalendar ? calendarError : listError
  ) as ApiErrorShape | null;
  const errorMessage = resolveErrorMessage(
    deleteError,
    activeError,
    Boolean(activeError)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <TransactionsToolbar
        view={view}
        isCalendar={isCalendar}
        month={month}
        beneficiaryId={beneficiaryId}
        sidebarActiveCount={filters.sidebarActiveCount}
        onAdd={addModal.open}
        onViewChange={(next) => set({ view: next })}
        onMonthChange={(next) => set({ month: next })}
        onBeneficiaryChange={(next) => set({ beneficiaryId: next })}
        onOpenFilters={() => setFilterSidebarOpen(true)}
      />

      {isCalendar ? (
        <CalendarView
          transactions={calendarTxns}
          timezone={timezone}
          currencyCode={currencyCode}
          currencySymbol={currencySymbol}
          monthKey={calendarMonthKey}
          onMonthChange={setCalendarMonthKey}
          weekAnchorIso={calendarWeekAnchor}
          onWeekAnchorChange={setCalendarWeekAnchor}
          focusedIso={calendarFocusedIso}
          onFocusedIsoChange={setCalendarFocusedIso}
          onDaySelect={(iso) => dayPanel.openWith(iso)}
          isLoading={calendarLoading}
        />
      ) : (
        <TransactionListBody
          isMerchant={isMerchant}
          listLoading={listLoading}
          groups={groups}
          groupedPeriodType={groupedPeriod.type}
          groupedPeriodStart={groupedPeriod.start}
          transactions={transactions}
          tags={tags}
          timezone={timezone}
          currencyCode={currencyCode}
          currencySymbol={currencySymbol}
          highlightTxnId={highlightTxnId}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          sentinelRef={sentinelRef}
          onOpenEdit={handleEdit}
          onShowMerchant={showMerchantTransactions}
          onFetchNext={() => void fetchNextPage()}
        />
      )}

      {errorMessage && (
        <div className="form-error mt-4 text-center">
          {String(errorMessage)}
        </div>
      )}

      <Modal
        open={addModal.isOpen}
        onClose={() => {
          addModal.close();
          setAddModalDefaultDate(null);
        }}
        size="lg"
        title="Add transaction"
      >
        <AddTransactionPage
          embedded
          defaultDate={addModalDefaultDate ?? undefined}
          onClose={() => {
            addModal.close();
            setAddModalDefaultDate(null);
          }}
          onSaved={(txnId) => flash(txnId)}
        />
      </Modal>
      <Modal
        open={editModal.isOpen}
        onClose={editModal.close}
        size="lg"
        title="Edit transaction"
        headerActions={
          editingIsManual && editingTxn ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(editingTxn.txn_id)}
              aria-label="Remove transaction"
              title="Remove transaction"
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-500 dark:text-danger-400 dark:hover:bg-danger-950/40 dark:hover:text-danger-300 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
              data-testid="transaction-form-remove"
            >
              <Trash2 aria-hidden size={16} />
            </button>
          ) : null
        }
      >
        {editModal.value && (
          <EditTransactionPage
            embedded
            idOverride={editModal.value}
            onClose={editModal.close}
            onSaved={(txnId) => flash(txnId)}
          />
        )}
      </Modal>
      <DaySidePanel
        open={dayPanel.isOpen}
        onClose={dayPanel.close}
        iso={dayPanel.value}
        transactions={dayTxns}
        tags={tags}
        timezone={timezone}
        currencyCode={currencyCode}
        currencySymbol={currencySymbol}
        onEdit={(txnId) => {
          dayPanel.close();
          editModal.openWith(String(txnId));
        }}
        onAdd={(iso) => {
          setAddModalDefaultDate(iso);
          dayPanel.close();
          addModal.open();
        }}
      />
      <FilterSidebar
        open={filterSidebarOpen}
        onClose={() => setFilterSidebarOpen(false)}
        view={view}
        type={type}
        tag={tag}
        sortBy={sortBy}
        order={order}
        tags={tags}
        onTypeChange={(next) => set({ type: next })}
        onTagChange={(next) => set({ tag: next })}
        onSortByChange={(next) => set({ sortBy: next })}
        onOrderChange={(next) => set({ order: next })}
        onClearAll={clearAll}
      />
      <ConfirmDialog
        open={confirmDeleteId != null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        intent="danger"
        title="Delete transaction"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
      />
    </div>
  );
}

interface TransactionsToolbarProps {
  view: TransactionView;
  isCalendar: boolean;
  month: string;
  beneficiaryId: string;
  sidebarActiveCount: number;
  onAdd: () => void;
  onViewChange: (next: TransactionView) => void;
  onMonthChange: (next: string) => void;
  onBeneficiaryChange: (next: string) => void;
  onOpenFilters: () => void;
}

// Page chrome above the content: title + Add / Import actions, the
// list/merchant/calendar view toggle, and the always-visible quick controls
// (month dropdown — hidden in calendar — merchant search, filter button).
// Split out of TransactionsPage to keep that component under the complexity /
// line gates; purely presentational, all state stays on the page.
function TransactionsToolbar({
  view,
  isCalendar,
  month,
  beneficiaryId,
  sidebarActiveCount,
  onAdd,
  onViewChange,
  onMonthChange,
  onBeneficiaryChange,
  onOpenFilters,
}: TransactionsToolbarProps) {
  // Statement-upload safety valve — BE may disable on resource-
  // constrained deploys. Defaults open until BE ships the flag.
  const { statement_upload_enabled: importEnabled } = useCapabilities();
  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Transactions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View and manage your transaction history
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onAdd} className="btn-primary !w-auto">
            + Add Transaction
          </button>
          {importEnabled && (
            <Link
              to="/upload-statement"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FileUp aria-hidden="true" size={16} />
              Import Statement
            </Link>
          )}
        </div>
      </header>

      {/* Row 1 — primary view toggle. Three pills, equal weight. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Transactions view"
          className="inline-flex rounded-md bg-slate-100 p-1 dark:bg-slate-800"
        >
          {VIEW_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => onViewChange(value)}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                view === value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
              }`}
            >
              <Icon aria-hidden size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2 — always-visible quick controls. Month dropdown hidden
          in Calendar (calendar has its own prev/next month nav).
          Merchant search + Filter icon ride along in every view. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
        {!isCalendar && (
          <MonthDropdown value={month} onChange={onMonthChange} />
        )}
        <MerchantSearchBar
          beneficiaryId={beneficiaryId}
          onChange={onBeneficiaryChange}
        />
        <div className="ml-auto">
          <button
            type="button"
            onClick={onOpenFilters}
            aria-label={
              sidebarActiveCount > 0
                ? `Open filters (${sidebarActiveCount} active)`
                : 'Open filters'
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <SlidersHorizontal aria-hidden size={14} />
            Filters
            {sidebarActiveCount > 0 && (
              <span className="bg-accent-600 dark:bg-accent-500 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white">
                {sidebarActiveCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

interface TransactionListBodyProps {
  isMerchant: boolean;
  listLoading: boolean;
  groups: MerchantGroup[];
  // Active grouped-read window (BE 2026-06-06). Drives the merchant
  // view's scope pill + empty-state copy. Null on the flat list view
  // / before the first page resolves.
  groupedPeriodType: 'weekly' | 'monthly' | 'all' | string | null;
  groupedPeriodStart: string | null;
  transactions: TransactionDTO[];
  tags: FlatTag[];
  timezone: string;
  currencyCode: string;
  currencySymbol: string | null;
  highlightTxnId: number | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  sentinelRef: React.RefObject<HTMLDivElement>;
  onOpenEdit: (id: number) => void;
  onShowMerchant: (beneficiaryUid: number) => void;
  onFetchNext: () => void;
}

// The list / merchant card: count header, the rows (loading / empty / list,
// resolved via early returns instead of a nested ternary), and the
// pagination chrome (mobile "Show more" + desktop IntersectionObserver
// sentinel). Split out of TransactionsPage to clear the nested-conditional
// and complexity warnings.
function TransactionListBody({
  isMerchant,
  listLoading,
  groups,
  groupedPeriodType,
  groupedPeriodStart,
  transactions,
  tags,
  timezone,
  currencyCode,
  currencySymbol,
  highlightTxnId,
  hasNextPage,
  isFetchingNextPage,
  sentinelRef,
  onOpenEdit,
  onShowMerchant,
  onFetchNext,
}: TransactionListBodyProps) {
  const countLabel = isMerchant
    ? pluralCount(groups.length, 'merchant')
    : pluralCount(transactions.length, 'transaction');
  const scopeLabel =
    isMerchant && groupedPeriodType
      ? scopePillCopy(groupedPeriodType, groupedPeriodStart)
      : null;

  function renderRows() {
    if (listLoading) {
      return (
        <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          Loading…
        </div>
      );
    }
    if (isMerchant) {
      if (groups.length === 0) {
        return (
          <div className="px-4 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
            {merchantEmptyCopy(groupedPeriodType, scopeLabel)}
          </div>
        );
      }
      return (
        <ul className="flex flex-col">
          {groups.map((g) => (
            <MerchantRow
              key={g.beneficiary_id}
              group={g}
              currencyCode={currencyCode}
              currencySymbol={currencySymbol}
              onDetails={onShowMerchant}
            />
          ))}
        </ul>
      );
    }
    if (transactions.length === 0) {
      return (
        <div className="px-4 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          No transactions found.
        </div>
      );
    }
    return (
      <ul className="flex flex-col">
        {transactions.map((t) => (
          <TransactionRow
            key={t.txn_id}
            txn={t}
            tags={tags}
            timezone={timezone}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            highlighted={highlightTxnId === t.txn_id}
            onOpen={onOpenEdit}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <span>{countLabel}</span>
        {scopeLabel && (
          <span
            data-testid="merchant-scope-pill"
            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {scopeLabel}
          </span>
        )}
      </div>

      {renderRows()}

      {/* Pagination chrome. "Show more" button (mobile) +
          IntersectionObserver sentinel (desktop) both sit in the
          same DOM; CSS gates which one is visible / active. */}
      {hasNextPage && (
        <div className="border-t border-slate-100 px-4 py-3 text-center dark:border-slate-800">
          <button
            type="button"
            onClick={onFetchNext}
            disabled={isFetchingNextPage}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isFetchingNextPage ? 'Loading…' : 'Show more'}
          </button>
          <div ref={sentinelRef} aria-hidden className="hidden h-1 md:block" />
          {isFetchingNextPage && (
            <span className="hidden text-xs text-slate-400 md:inline-block dark:text-slate-500">
              Loading more…
            </span>
          )}
        </div>
      )}
    </div>
  );
}
