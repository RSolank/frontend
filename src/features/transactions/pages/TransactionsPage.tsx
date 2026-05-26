import { useQueryClient } from '@tanstack/react-query';
import { FileUp, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useCurrenciesQuery } from '../../metadata/api/queries';
import { useTagsQuery, type TagNode } from '../../tags/api/queries';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { Modal } from '../../../shared/components/Modal';
import { useModal, useUrlValueModal } from '../../../shared/hooks/useModal';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { formatMoney } from '../../../shared/utils/currency';
import { formatDate } from '../../../shared/utils/dateUtils';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { transactionKeys, type TransactionListParams } from '../api/keys';
import { deleteTransactionRequest } from '../api/mutations';
import { useTransactionsQuery } from '../api/queries';
import type {
  MerchantGroup,
  TransactionDTO,
} from '../api/schemas';

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

function flattenTags(nodes: TagNode[] | undefined, out: FlatTag[] = []): FlatTag[] {
  for (const n of nodes ?? []) {
    out.push({ tag_id: n.tag_id, tag_name: n.tag_name });
    flattenTags(n.children, out);
  }
  return out;
}

interface ActionDropdownProps {
  txn: TransactionDTO;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

function ActionDropdown({ txn, onEdit, onDelete }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isManual = txn.source === 'manual';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isManual) {
    return (
      <button
        type="button"
        onClick={() => onEdit(txn.txn_id)}
        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        Edit
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <div className="inline-flex items-center overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => onEdit(txn.txn_id)}
          className="border-r border-slate-200 px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-slate-200 dark:border-slate-700 dark:text-indigo-400 dark:hover:bg-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className="px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          ▼
        </button>
      </div>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-[110px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => {
              onDelete(txn.txn_id);
              setIsOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 25;
type ViewMode = 'list' | 'merchant';
type FilterType = 'all' | 'debit' | 'credit';
type Order = 'asc' | 'desc';

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const currencyCode = usePreferencesStore((s) => s.currency);
  const timezone = usePreferencesStore((s) => s.timezone);
  const { data: currencies } = useCurrenciesQuery();
  const { data: tagsData } = useTagsQuery();
  const tags = useMemo(() => flattenTags(tagsData?.tags), [tagsData?.tags]);
  const currencySymbol = useMemo(
    () =>
      currencies?.find((c) => c.code === currencyCode)?.symbol ?? null,
    [currencies, currencyCode]
  );

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [order, setOrder] = useState<Order>('desc');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const addModal = useModal({ urlKey: 'add' });
  const editModal = useUrlValueModal('edit');
  const { id: highlightTxnId, flash } = useRowHighlight<number>();

  const params: TransactionListParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      ...(filterType !== 'all' ? { debit_credit: filterType } : {}),
      ...(viewMode === 'merchant' ? { group_by: 'merchant' as const } : {}),
      sort_by: sortBy,
      order,
      ...(selectedTag ? { tag_id: selectedTag } : {}),
      ...(selectedMonth ? { month: selectedMonth } : {}),
      ...(filterBeneficiaryId ? { beneficiary_id: filterBeneficiaryId } : {}),
    }),
    [
      page,
      filterType,
      viewMode,
      sortBy,
      order,
      selectedTag,
      selectedMonth,
      filterBeneficiaryId,
    ]
  );

  const { data, isLoading, error } = useTransactionsQuery(params);

  const transactions: TransactionDTO[] = data?.transactions ?? [];
  const groups: MerchantGroup[] = data?.groups ?? [];
  const hasMore = (data?.returned_count ?? 0) === PAGE_SIZE;

  function showMerchantTransactions(beneficiaryId: number) {
    setViewMode('list');
    setSortBy('date');
    setFilterBeneficiaryId(String(beneficiaryId));
    setPage(0);
  }

  function handleDelete(id: number) {
    setConfirmDeleteId(id);
  }

  async function handleConfirmDelete() {
    if (confirmDeleteId == null) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteTransactionRequest(confirmDeleteId);
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      setConfirmDeleteId(null);
      // Close the edit modal if Remove was triggered from inside it
      // (modal-header convention). Row-button deletes already close
      // cleanly; the modal-Trash path needs the explicit dismiss.
      editModal.close();
    } catch (err) {
      const e = err as ApiErrorShape;
      setDeleteError(e.detail || e.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // Editing-txn lookup for the modal-header Remove gate. Only manual
  // transactions are deletable per the row-dropdown rule; the modal
  // mirrors that gate (no Trash for statement-imported rows).
  const editingTxn: TransactionDTO | null = useMemo(() => {
    if (editModal.value == null) return null;
    const id = Number(editModal.value);
    return transactions.find((t) => t.txn_id === id) ?? null;
  }, [editModal.value, transactions]);
  const editingIsManual = editingTxn?.source === 'manual';

  function handleEdit(id: number) {
    editModal.openWith(String(id));
  }

  function handleSort(field: string) {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setPage(0);
  }

  function fmtAmount(amount: number): string {
    return formatMoney(Math.abs(amount), currencyCode, currencySymbol);
  }

  const loadError =
    error && typeof error === 'object'
      ? (error as ApiErrorShape).detail ||
        (error as ApiErrorShape).error ||
        'Failed to load data'
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
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
          {/* Beneficiaries and Dashboard navigation are now in TopNav
              (Batch 6.5 follow-up), so the page header keeps only the
              primary actions (manual add + bulk import). */}
          <button
            type="button"
            onClick={addModal.open}
            className="btn-primary !w-auto"
          >
            + Add Transaction
          </button>
          {/*
            Statement upload is a 4+ step pipeline (parse → map →
            categorize → review → finalize), so it stays a page route
            per the §6 modal-vs-page contract (wizards beyond ~3 steps
            promote to a page).
          */}
          <Link
            to="/upload-statement"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileUp aria-hidden="true" size={16} />
            Import Statement
          </Link>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
        <div className="inline-flex rounded-md bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setSortBy('date');
              setPage(0);
            }}
            className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
            }`}
          >
            List View
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('merchant');
              setSortBy('total_amount');
              setPage(0);
            }}
            className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              viewMode === 'merchant'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
            }`}
          >
            Merchant View
          </button>
        </div>

        <select
          aria-label="Filter type"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value as FilterType);
            setPage(0);
          }}
          className="form-input w-auto"
        >
          <option value="all">All Types</option>
          <option value="debit">Debit Only</option>
          <option value="credit">Credit Only</option>
        </select>

        <select
          aria-label="Filter tag"
          value={selectedTag}
          onChange={(e) => {
            setSelectedTag(e.target.value);
            setPage(0);
          }}
          className="form-input w-auto"
        >
          <option value="">All Tags</option>
          {tags.map((t) => (
            <option key={t.tag_id} value={t.tag_id}>
              {t.tag_name}
            </option>
          ))}
        </select>

        <input
          type="month"
          aria-label="Filter month"
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setPage(0);
          }}
          className="form-input w-auto"
        />

        {filterBeneficiaryId && (
          <button
            type="button"
            onClick={() => {
              setFilterBeneficiaryId('');
              setPage(0);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Clear merchant filter
          </button>
        )}
      </div>

      {/*
        Responsive contract (CONTRIBUTING.md §6): tables scroll inside
        their card on narrow viewports rather than forcing body overflow.
      */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {viewMode === 'list'
              ? `Total Records: ${transactions.length}`
              : `Total Merchants: ${groups.length}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
                {viewMode === 'list' ? (
                  <>
                    <th
                      scope="col"
                      onClick={() => handleSort('date')}
                      className="cursor-pointer px-4 py-3"
                    >
                      Date{' '}
                      {sortBy === 'date' && (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Beneficiary
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('amount')}
                      className="cursor-pointer px-4 py-3 text-right"
                    >
                      Amount{' '}
                      {sortBy === 'amount' && (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Tags
                    </th>
                    <th scope="col" className="px-4 py-3 text-center">
                      Actions
                    </th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="px-4 py-3">
                      Merchant
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('frequency')}
                      className="cursor-pointer px-4 py-3 text-right"
                    >
                      Frequency{' '}
                      {sortBy === 'frequency' && (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('total_amount')}
                      className="cursor-pointer px-4 py-3 text-right"
                    >
                      Total Spend{' '}
                      {sortBy === 'total_amount' &&
                        (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center">
                      Actions
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : viewMode === 'list' ? (
                transactions.map((t) => (
                  <tr
                    key={t.txn_id}
                    className={`border-b border-slate-100 transition-colors last:border-b-0 dark:border-slate-800 ${
                      highlightTxnId === t.txn_id
                        ? 'bg-indigo-50/60 ring-2 ring-indigo-500 ring-inset dark:bg-indigo-950/30'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {formatDate(t.txn_date, timezone)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.beneficiary_id ? (
                        <Link
                          to={`/beneficiaries/${t.beneficiary_id}`}
                          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {t.beneficiary_name || t.beneficiary || '—'}
                        </Link>
                      ) : (
                        t.beneficiary_name || t.beneficiary || '—'
                      )}
                    </td>
                    <td
                      className={`money px-4 py-3 text-right text-sm font-bold ${
                        t.debit_credit === 'debit'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {t.debit_credit === 'debit' ? '-' : '+'}
                      {fmtAmount(t.amount || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(t.tag_ids || []).map((tid) => {
                          const tag = tags.find((tg) => tg.tag_id === tid);
                          return (
                            <span
                              key={tid}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {tag ? tag.tag_name : `Tag ${tid}`}
                            </span>
                          );
                        })}
                        {(!t.tag_ids || t.tag_ids.length === 0) && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            Uncategorized
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActionDropdown
                        txn={t}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                groups.map((g) => (
                  <tr
                    key={g.beneficiary_id}
                    className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link
                        to={`/beneficiaries/${g.beneficiary_id}`}
                        className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {g.beneficiary_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-200">
                      {g.frequency}
                    </td>
                    <td
                      className={`money px-4 py-3 text-right text-sm font-bold ${
                        g.total_amount > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : g.total_amount < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {g.total_amount > 0 ? '+' : g.total_amount < 0 ? '-' : ''}
                      {fmtAmount(g.total_amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          showMerchantTransactions(g.beneficiary_id)
                        }
                        className="text-sm font-semibold text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!isLoading &&
                (viewMode === 'list'
                  ? transactions.length
                  : groups.length) === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-slate-400 dark:text-slate-500"
                    >
                      No transactions found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {(loadError || deleteError) && (
        <div className="form-error mt-4 text-center">
          {loadError || deleteError}
        </div>
      )}

      <Modal
        open={addModal.isOpen}
        onClose={addModal.close}
        size="lg"
        title="Add transaction"
      >
        <AddTransactionPage
          embedded
          onClose={addModal.close}
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
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
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

