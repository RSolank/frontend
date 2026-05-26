import { useMemo } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { useCurrenciesQuery } from '../../metadata/api/queries';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatMoney } from '../../../shared/utils/currency';
import {
  useBillQuery,
  type BillDetail,
  type BillItem,
} from '../api/queries';
import { formatBillDate } from '../api/billPeriod';

interface BillDetailDialogProps {
  billId: number | null;
  open: boolean;
  onClose: () => void;
  // When provided, the modal renders a Pay action in the footer for
  // bills with status === 'pending'. Click delegates upward so the
  // parent owns the confirm + mutation flow (same path the row-level
  // Pay button uses). Optional — list pages that don't expose pay
  // semantics (e.g. an admin viewer) can omit it.
  onPay?: (billId: number) => void;
}

// Modal-first detail surface for a single bill. Shows totals, the
// per-txn breakdown table, and a penalty-tag summary that aggregates
// the penalty lines by tag so the user can see which budget breaches
// drove the bill.
//
// Pay-from-modal contract (2026-05-26 design lock): pending bills can
// be paid both from the row and from inside the modal — the row keeps
// the quick-action path for users who don't need to inspect the
// breakdown, the modal mirrors it for the breakdown-first workflow.
export function BillDetailDialog({
  billId,
  open,
  onClose,
  onPay,
}: BillDetailDialogProps) {
  const currencyCode = usePreferencesStore((s) => s.currency);
  const timezone = usePreferencesStore((s) => s.timezone);
  const { data: currencies } = useCurrenciesQuery();
  const currencySymbol = useMemo(
    () =>
      currencies?.find((c) => c.code === currencyCode)?.symbol ?? null,
    [currencies, currencyCode]
  );
  const { data: bill, isLoading, error } = useBillQuery(open ? billId : null);

  const money = (n: number | null | undefined) =>
    formatMoney(n ?? 0, currencyCode, currencySymbol);

  const titleRange = bill
    ? `${formatBillDate(bill.period_start, timezone)} → ${formatBillDate(bill.period_end, timezone)}`
    : '';

  const showPay = bill?.status === 'pending' && onPay != null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={bill ? `Bill — ${titleRange}` : 'Bill detail'}
      description={bill ? `Status: ${bill.status}` : undefined}
      footer={
        bill && (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Close
            </button>
            {showPay && (
              <button
                type="button"
                onClick={() => onPay?.(bill.bill_id)}
                className="btn-primary !w-auto"
                data-testid="bill-modal-pay"
              >
                Pay bill
              </button>
            )}
          </>
        )
      }
    >
      {isLoading && !bill && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
        >
          Failed to load bill details.
        </div>
      )}
      {bill && (
        <div className="flex flex-col gap-4">
          <TotalsRow bill={bill} money={money} />
          <PenaltyBreakdown items={bill.items ?? []} money={money} />
          <ItemsTable
            items={bill.items ?? []}
            money={money}
            timezone={timezone}
          />
        </div>
      )}
    </Modal>
  );
}

function TotalsRow({
  bill,
  money,
}: {
  bill: BillDetail;
  money: (n: number | null | undefined) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Total amount
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 money dark:text-slate-100">
          {money(bill.amount)}
        </div>
      </div>
      <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Tax total
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 money dark:text-slate-100">
          {money(bill.totals?.tax_total)}
        </div>
      </div>
      <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Penalty total
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 money dark:text-slate-100">
          {money(bill.totals?.penalty_total)}
        </div>
      </div>
    </div>
  );
}

interface PenaltyAgg {
  tag_id: number | null;
  tag_name: string;
  penalty: number;
  count: number;
}

function PenaltyBreakdown({
  items,
  money,
}: {
  items: BillItem[];
  money: (n: number | null | undefined) => string;
}) {
  const agg = useMemo<PenaltyAgg[]>(() => {
    const m = new Map<string, PenaltyAgg>();
    for (const it of items) {
      if (!it.penalty || it.penalty === 0) continue;
      const key = String(it.penalty_tag_id ?? it.penalty_tag_name ?? '_none');
      const existing = m.get(key);
      if (existing) {
        existing.penalty += it.penalty;
        existing.count += 1;
      } else {
        m.set(key, {
          tag_id: it.penalty_tag_id ?? null,
          tag_name:
            it.penalty_tag_name ??
            (it.penalty_tag_id ? `#${it.penalty_tag_id}` : 'Uncategorized'),
          penalty: it.penalty,
          count: 1,
        });
      }
    }
    return [...m.values()].sort((a, b) => b.penalty - a.penalty);
  }, [items]);

  if (agg.length === 0) return null;

  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
        Penalty breakdown by budget tag
      </h4>
      <ul className="flex flex-col gap-1.5">
        {agg.map((a) => (
          <li
            key={a.tag_name}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">{a.tag_name}</span>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                {a.count} txn{a.count === 1 ? '' : 's'}
              </span>
            </div>
            <span className="tabular-nums text-sm font-semibold text-slate-900 money dark:text-slate-100">
              {money(a.penalty)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemsTable({
  items,
  money,
  timezone,
}: {
  items: BillItem[];
  money: (n: number | null | undefined) => string;
  timezone: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No tax items on this bill.
      </div>
    );
  }
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
        Transactions on this bill
      </h4>
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="min-w-[52rem] w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Beneficiary</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Tax</th>
              <th className="px-3 py-2 text-right">Penalty</th>
              <th className="px-3 py-2">Penalty tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((it) => (
              <tr key={it.txn_id}>
                <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                  {formatBillDate(it.date, timezone)}
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                  {it.beneficiary || '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 capitalize dark:text-slate-300">
                  {it.txn_type}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900 money dark:text-slate-100">
                  {it.amount != null ? money(it.amount) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900 money dark:text-slate-100">
                  {money(it.tax_amount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900 money dark:text-slate-100">
                  {money(it.penalty)}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {it.penalty_tag_name ||
                    (it.penalty_tag_id ? `#${it.penalty_tag_id}` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
