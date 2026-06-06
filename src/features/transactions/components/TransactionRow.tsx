import { MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatMoney } from '../../../shared/utils/currency';
import { formatDate } from '../../../shared/utils/dateUtils';
import type { TransactionDTO } from '../api/schemas';

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

interface TransactionRowProps {
  txn: TransactionDTO;
  tags: FlatTag[];
  timezone: string;
  currencyCode: string;
  currencySymbol: string | null;
  highlighted: boolean;
  onOpen: (txnId: number) => void;
}

// Single transaction row. One component, two visual shapes via
// Tailwind responsive classes — flex-row at md+ (compact density),
// flex-col at <md (vertical card stack). Drives the new list view
// post-Batch-9.6 reshuffle: no column headers (sort moved to the
// filter sidebar), date in compact "Wed, May 28" form, tags as chips
// inline before the amount, amount right-aligned, MoreHorizontal
// actions menu at the far right.
//
// Clicking the row body opens the existing edit modal (URL state
// ?edit=<id>) — matches the row-level ⋯ → canonical view+edit
// surface convention locked alongside this batch.
export function TransactionRow({
  txn,
  tags,
  timezone,
  currencyCode,
  currencySymbol,
  highlighted,
  onOpen,
}: TransactionRowProps) {
  const dateLabel = formatDate(
    txn.txn_date,
    timezone,
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    },
    /* respectUserFormat */ false
  );

  const amountSign = txn.debit_credit === 'debit' ? '-' : '+';
  const amountColor =
    txn.debit_credit === 'debit'
      ? 'text-danger-600 dark:text-danger-400'
      : 'text-success-600 dark:text-success-400';

  return (
    <li
      className={`group flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-slate-50 md:flex-row md:items-center md:gap-3 md:py-2 dark:border-slate-800 dark:hover:bg-slate-900/60 ${
        highlighted
          ? 'bg-accent-50/60 ring-accent-500 dark:bg-accent-950/30 ring-2 ring-inset'
          : ''
      }`}
    >
      {/* Date — fixed-ish width on desktop so amounts stay column-aligned;
          full width above name on mobile. */}
      <div className="text-xs font-medium text-slate-500 md:w-28 md:shrink-0 md:text-sm dark:text-slate-400">
        {dateLabel}
      </div>

      {/* Beneficiary + tags — main content. Tags wrap to a second row
          on narrow viewports without pushing the amount around. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {txn.beneficiary_id ? (
            <Link
              to={`/beneficiaries/${txn.beneficiary_id}`}
              className="text-accent-700 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
              onClick={(e) => e.stopPropagation()}
            >
              {txn.beneficiary_name || txn.beneficiary || '—'}
            </Link>
          ) : (
            txn.beneficiary_name || txn.beneficiary || '—'
          )}
        </div>
        <div className="flex flex-wrap gap-1 md:ml-2">
          {(txn.tag_ids || []).map((tid) => {
            const tag = tags.find((t) => t.tag_id === tid);
            return (
              <span
                key={tid}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {tag ? tag.tag_name : `Tag ${tid}`}
              </span>
            );
          })}
        </div>
      </div>

      {/* Amount + actions. */}
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <span
          className={`money text-sm font-bold tabular-nums md:text-right ${amountColor}`}
        >
          {amountSign}
          {formatMoney(Math.abs(txn.amount || 0), currencyCode, currencySymbol)}
        </span>
        <button
          type="button"
          onClick={() => onOpen(txn.txn_id)}
          aria-label="View / edit transaction"
          title="View / edit"
          className="focus-visible:ring-accent-500 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <MoreHorizontal aria-hidden size={16} />
        </button>
      </div>
    </li>
  );
}
