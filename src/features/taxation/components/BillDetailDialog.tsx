import { MoreHorizontal } from 'lucide-react';
import { useMemo } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatBillDate } from '../api/billPeriod';
import { useBillQuery, type BillDetail, type BillItem } from '../api/queries';

import { BillStatusPill, isPayable, isUnpayable } from './billStatus';

interface BillDetailDialogProps {
  billId: number | null;
  open: boolean;
  onClose: () => void;
  // When provided, the modal renders a Mark-paid action in the footer
  // for BILLED / OVERDUE bills. Click delegates upward so the parent
  // owns the confirm + mutation flow (same path the row-level button
  // uses). Optional — viewers that don't expose pay semantics can
  // omit it.
  onMarkPaid?: (billId: number) => void;
  // BE Phase 2.6 — mark-unpaid is the undo of mark-paid; only
  // surfaced when the bill is settled. Same delegation pattern.
  onMarkUnpaid?: (billId: number) => void;
  // Per-item drilldown: clicking the ⋯ button on a BillItem row
  // delegates upward so the parent can navigate to the underlying
  // transaction's view/edit surface. Optional — viewers that can't
  // resolve a txn_id can omit it.
  onViewTransaction?: (txnId: number) => void;
}

// Modal-first detail surface for a single bill. Shows totals, the
// per-txn breakdown table, a penalty-tag summary that aggregates the
// penalty lines by tag, and (BE Phase 2.6) a separate "Adjustments"
// section for `is_adjustment=true` rows. Adjustments are tax-system
// artifacts — historical edits to past BILLED bills land as deltas on
// the current ACCRUING bill (Decision 23), not as edits to the
// original.
//
// Mark-paid / Mark-unpaid contract (BE Phase 2.6, Decision 25):
// settleable bills can be settled from the row and from inside the
// modal — the row keeps the quick-action path, the modal mirrors it
// for the breakdown-first workflow. PAID bills surface a Reopen
// affordance for the undo path.
export function BillDetailDialog({
  billId,
  open,
  onClose,
  onMarkPaid,
  onMarkUnpaid,
  onViewTransaction,
}: BillDetailDialogProps) {
  const timezone = usePreferencesStore((s) => s.timezone);
  const { money } = useMoneyFormatter();
  const { data: bill, isLoading, error } = useBillQuery(open ? billId : null);

  const titleRange = bill
    ? `${formatBillDate(bill.period_start, timezone)} → ${formatBillDate(bill.period_end, timezone)}`
    : '';

  const showMarkPaid =
    bill != null && isPayable(bill.status) && onMarkPaid != null;
  const showMarkUnpaid =
    bill != null && isUnpayable(bill.status) && onMarkUnpaid != null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={bill ? `Bill — ${titleRange}` : 'Bill detail'}
      description={bill ? `Bill #${bill.bill_id}` : undefined}
      footer={
        bill && (
          <BillDetailFooter
            bill={bill}
            onClose={onClose}
            onMarkPaid={showMarkPaid ? onMarkPaid : undefined}
            onMarkUnpaid={showMarkUnpaid ? onMarkUnpaid : undefined}
          />
        )
      }
    >
      <BillDetailBody
        bill={bill ?? null}
        isLoading={isLoading}
        hasError={error != null}
        timezone={timezone}
        money={money}
        onViewTransaction={onViewTransaction}
      />
    </Modal>
  );
}

// Body extracted from the main render — loading + error + populated
// branches were pushing cyclomatic complexity over the §3 ceiling
// (15). Splitting the body keeps the dialog declarative and the
// branch logic isolated here. `useMemo` lives here too so the
// adjustments/realItems split only runs when the bill changes.
function BillDetailBody({
  bill,
  isLoading,
  hasError,
  timezone,
  money,
  onViewTransaction,
}: {
  bill: BillDetail | null;
  isLoading: boolean;
  hasError: boolean;
  timezone: string;
  money: (n: number | null | undefined) => string;
  onViewTransaction?: (txnId: number) => void;
}) {
  const { realItems, adjustments } = useMemo(() => {
    const list = bill?.items ?? [];
    return {
      realItems: list.filter((it) => !it.is_adjustment),
      adjustments: list.filter((it) => it.is_adjustment),
    };
  }, [bill]);

  if (isLoading && !bill) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
    );
  }
  if (hasError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
      >
        Failed to load bill details.
      </div>
    );
  }
  if (!bill) return null;

  return (
    <div className="flex flex-col gap-4">
      <BillHeaderStrip bill={bill} money={money} />
      <TotalsRow bill={bill} money={money} />
      <PenaltyBreakdown items={realItems} money={money} />
      <ItemsTable
        items={realItems}
        money={money}
        timezone={timezone}
        onViewTransaction={onViewTransaction}
      />
      {adjustments.length > 0 && (
        <AdjustmentsTable
          items={adjustments}
          money={money}
          timezone={timezone}
        />
      )}
    </div>
  );
}

// Footer extracted from the main render so BillDetailDialog stays
// under the §3 complexity ceiling — the dual mark-paid / mark-unpaid
// branching pushed it to 17 without this split.
function BillDetailFooter({
  bill,
  onClose,
  onMarkPaid,
  onMarkUnpaid,
}: {
  bill: BillDetail;
  onClose: () => void;
  onMarkPaid?: (billId: number) => void;
  onMarkUnpaid?: (billId: number) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Close
      </button>
      {onMarkUnpaid && (
        <button
          type="button"
          onClick={() => onMarkUnpaid(bill.bill_id)}
          className="hover:border-danger-300 hover:text-danger-700 focus-visible:ring-danger-500 dark:hover:border-danger-800 dark:hover:text-danger-300 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors focus-visible:ring-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          data-testid="bill-modal-mark-unpaid"
        >
          Reopen
        </button>
      )}
      {onMarkPaid && (
        <button
          type="button"
          onClick={() => onMarkPaid(bill.bill_id)}
          className="btn-primary !w-auto"
          data-testid="bill-modal-mark-paid"
        >
          Mark paid
        </button>
      )}
    </>
  );
}

// Status strip — pill + amount_paid / amount progress (only shown when
// partial). Replaces the old `Status: pending` description string with
// a more informative visual.
function BillHeaderStrip({
  bill,
  money,
}: {
  bill: BillDetail;
  money: (n: number | null | undefined) => string;
}) {
  const total = bill.amount ?? 0;
  const paid = bill.amount_paid ?? 0;
  const showProgress =
    total > 0 && paid > 0 && paid < total && bill.status !== 'PAID';
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
      <BillStatusPill status={bill.status} />
      {paid > 0 && (
        <span className="text-slate-600 dark:text-slate-300">
          <span className="money tabular-nums">{money(paid)}</span>
          {paid < total && (
            <>
              {' '}
              of <span className="money tabular-nums">{money(total)}</span>{' '}
              settled
            </>
          )}
          {paid >= total && total > 0 && ' settled'}
        </span>
      )}
      {showProgress && (
        <div className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="bg-success-500 dark:bg-success-400 h-full"
            style={{ width: `${Math.min((paid / total) * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
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
        <div className="money mt-0.5 text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
          {money(bill.amount)}
        </div>
      </div>
      <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Tax total
        </div>
        <div className="money mt-0.5 text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
          {money(bill.totals?.tax_total)}
        </div>
      </div>
      <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Penalty total
        </div>
        <div className="money mt-0.5 text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
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
            <span className="money text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
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
  onViewTransaction,
}: {
  items: BillItem[];
  money: (n: number | null | undefined) => string;
  timezone: string;
  onViewTransaction?: (txnId: number) => void;
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
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Beneficiary</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Tax</th>
              <th className="px-3 py-2 text-right">Penalty</th>
              <th className="px-3 py-2">Penalty tag</th>
              {onViewTransaction && (
                <th className="px-3 py-2 text-right">
                  <span className="sr-only">View transaction</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((it) => (
              <tr key={it.txn_id ?? `noid-${it.date}-${it.tax_amount}`}>
                <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                  {formatBillDate(it.date, timezone)}
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                  {it.beneficiary || '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 capitalize dark:text-slate-300">
                  {it.txn_type}
                </td>
                <td className="money px-3 py-2 text-right text-slate-900 tabular-nums dark:text-slate-100">
                  {it.amount != null ? money(it.amount) : '—'}
                </td>
                <td className="money px-3 py-2 text-right text-slate-900 tabular-nums dark:text-slate-100">
                  {money(it.tax_amount)}
                </td>
                <td className="money px-3 py-2 text-right text-slate-900 tabular-nums dark:text-slate-100">
                  {money(it.penalty)}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {it.penalty_tag_name ||
                    (it.penalty_tag_id ? `#${it.penalty_tag_id}` : '—')}
                </td>
                {onViewTransaction && (
                  <td className="px-3 py-2 text-right">
                    {it.txn_id != null && (
                      <button
                        type="button"
                        onClick={() => onViewTransaction(it.txn_id as number)}
                        aria-label="View / edit transaction"
                        title="View / edit transaction"
                        className="focus-visible:ring-accent-500 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <MoreHorizontal aria-hidden size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// BE Phase 2.6 (Decision 23) — historical edits to past BILLED bills
// post deltas to the current ACCRUING bill as `is_adjustment=true`
// rows that point back at the originating bill. The user sees them as
// a dedicated section because they are NOT transactions they made
// this week — they are corrections to past tax owed.
function AdjustmentsTable({
  items,
  money,
  timezone,
}: {
  items: BillItem[];
  money: (n: number | null | undefined) => string;
  timezone: string;
}) {
  return (
    <section data-testid="bill-adjustments">
      <h4 className="text-warning-700 dark:text-warning-300 mb-2 text-sm font-semibold">
        Adjustments (from past bills)
      </h4>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Edits to transactions from past finalized bills land here as corrections
        — the original bill isn&apos;t mutated.
      </p>
      <div className="border-warning-200 dark:border-warning-900/40 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-warning-50 dark:bg-warning-950/30">
            <tr className="text-warning-800 dark:text-warning-200 text-left text-xs font-semibold tracking-wide uppercase">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Source bill</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Tax delta</th>
              <th className="px-3 py-2 text-right">Penalty delta</th>
            </tr>
          </thead>
          <tbody className="divide-warning-100 dark:divide-warning-900/40 divide-y">
            {items.map((it, idx) => (
              <tr
                key={`adj-${it.txn_id ?? idx}-${it.adjustment_for_bill_id ?? 0}`}
              >
                <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                  {formatBillDate(it.date, timezone)}
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                  {it.adjustment_for_bill_id != null
                    ? `Bill #${it.adjustment_for_bill_id}`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 capitalize dark:text-slate-300">
                  {it.txn_type}
                </td>
                <td className="money px-3 py-2 text-right text-slate-900 tabular-nums dark:text-slate-100">
                  {money(it.tax_amount)}
                </td>
                <td className="money px-3 py-2 text-right text-slate-900 tabular-nums dark:text-slate-100">
                  {money(it.penalty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
