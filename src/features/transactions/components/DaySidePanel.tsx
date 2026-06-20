import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { RecurringChip } from '../../../shared/components/RecurringChip';
import { formatMoney } from '../../../shared/utils/currency';
import { formatDate } from '../../../shared/utils/dateUtils';
import type { TransactionDTO } from '../api/schemas';

// Day flyout — slide-in side panel anchored right on ≥ lg, bottom-
// sheet on < lg. Lists every transaction on the selected day plus
// running totals + a quick "Add transaction for this day" CTA that
// opens the existing add-transaction modal with the day pre-filled.
//
// Built on Radix UI's Dialog primitives (same as
// `shared/components/Modal.tsx`) for focus trap, escape close, ARIA
// role=dialog, and scroll lock. We don't reuse Modal directly
// because the responsive surface is materially different — Modal
// centers; DaySidePanel slides in from the edge.

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

interface DaySidePanelProps {
  open: boolean;
  onClose: () => void;
  // The selected day as `YYYY-MM-DD` (local-tz). null while closed.
  iso: string | null;
  // Already-bucketed transactions for the day. Caller filters from
  // the page-level useTransactionsQuery result so React Query's
  // cache stays the source of truth.
  transactions: TransactionDTO[];
  tags: FlatTag[];
  timezone: string;
  currencyCode: string;
  currencySymbol: string | null;
  // Click an existing row → open the edit modal. We route through
  // the parent so URL state mirrors the page's existing edit modal
  // contract (`?edit=<id>`).
  onEdit: (txnId: number) => void;
  // Click "Add transaction" → opens the parent's add modal pre-
  // filled with this day. The Add form reads `?day=` indirectly via
  // the URL, so the parent typically just maps this to its own
  // addModal.open() while leaving `?day=<iso>` intact.
  onAdd: (iso: string) => void;
}

export function DaySidePanel({
  open,
  onClose,
  iso,
  transactions,
  tags,
  timezone,
  currencyCode,
  currencySymbol,
  onEdit,
  onAdd,
}: DaySidePanelProps) {
  const dayLabel = iso
    ? formatDate(`${iso}T12:00:00Z`, timezone, {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  let debitTotal = 0;
  let creditTotal = 0;
  for (const t of transactions) {
    if (t.debit_credit === 'debit') debitTotal += Math.abs(t.amount);
    else creditTotal += Math.abs(t.amount);
  }
  const netLabel = `Net: ${formatMoney(
    Math.abs(creditTotal - debitTotal),
    currencyCode,
    currencySymbol
  )}`;

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
          // Side panel: right edge on ≥ sm, bottom-sheet on < sm.
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] w-full flex-col rounded-t-xl bg-white shadow-xl outline-none sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {dayLabel || 'Day'}
              </Dialog.Title>
              {transactions.length > 0 && (
                <Dialog.Description className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {transactions.length}{' '}
                  {transactions.length === 1 ? 'transaction' : 'transactions'}
                  {' · '}
                  <span className="money text-danger-600 dark:text-danger-400 font-medium">
                    -{formatMoney(debitTotal, currencyCode, currencySymbol)}
                  </span>
                  {creditTotal > 0 && (
                    <>
                      {' · '}
                      <span className="money text-success-600 dark:text-success-400 font-medium">
                        +
                        {formatMoney(creditTotal, currencyCode, currencySymbol)}
                      </span>
                    </>
                  )}
                  {creditTotal > 0 && debitTotal > 0 && (
                    <span className="money ml-1 text-slate-500 dark:text-slate-400">
                      ({netLabel})
                    </span>
                  )}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X aria-hidden size={18} />
              </button>
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {transactions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No transactions on this day.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {transactions.map((t) => (
                  <li
                    key={t.txn_id}
                    className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {t.beneficiary_id ? (
                            <Link
                              to={`/beneficiaries/${t.beneficiary_id}`}
                              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
                            >
                              {t.beneficiary_name || '—'}
                            </Link>
                          ) : (
                            t.beneficiary_name || '—'
                          )}
                        </div>
                        {(t.tag_ids || []).length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(t.tag_ids || []).map((tid) => {
                              const tag = tags.find((tg) => tg.tag_id === tid);
                              return (
                                <span
                                  key={tid}
                                  className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {tag ? tag.tag_name : `Tag ${tid}`}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            Uncategorized
                          </div>
                        )}
                        {t.recurring_template_id != null && (
                          <div className="mt-1">
                            <RecurringChip templateId={t.recurring_template_id} />
                          </div>
                        )}
                        {t.notes && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                            {t.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`money text-sm font-bold ${
                            t.debit_credit === 'debit'
                              ? 'text-danger-600 dark:text-danger-400'
                              : 'text-success-600 dark:text-success-400'
                          }`}
                        >
                          {t.debit_credit === 'debit' ? '-' : '+'}
                          {formatMoney(
                            Math.abs(t.amount || 0),
                            currencyCode,
                            currencySymbol
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEdit(t.txn_id)}
                          className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 text-xs font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => iso && onAdd(iso)}
              className="btn-primary inline-flex w-full items-center justify-center gap-1.5 !py-2"
            >
              <Plus aria-hidden size={16} />
              Add transaction for this day
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
