import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useUrlValueModal } from '../../../shared/hooks/useModal';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatBillDate } from '../api/billPeriod';
import { taxationKeys } from '../api/keys';
import { payBillRequest } from '../api/mutations';
import {
  useBillsQuery,
  type BillStatus,
  type BillSummary,
} from '../api/queries';
import { BillDetailDialog } from '../components/BillDetailDialog';
import { CurrentWeekTracker } from '../components/CurrentWeekTracker';
import { GenerateBillsDialog } from '../components/GenerateBillsDialog';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

export function TaxTrackerPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const timezone = usePreferencesStore((s) => s.timezone);
  const { money } = useMoneyFormatter();

  const { data, isLoading, error } = useBillsQuery();
  const bills: BillSummary[] = data?.bills ?? [];

  // Detail modal is URL-state-synced so /consumption-tax?view=<id>
  // reopens on reload + is shareable.
  const viewModal = useUrlValueModal('view');
  const viewBillId = viewModal.value != null ? Number(viewModal.value) : null;

  // Generate dialog is transient (no URL state) — it's just a "do
  // this now" action surface.
  const [generateOpen, setGenerateOpen] = useState(false);

  const [confirmPayBillId, setConfirmPayBillId] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { id: highlightBillId, flash } = useRowHighlight<number>();

  async function handleGenerated(billIds: number[]) {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: taxationKeys.bills() });
    const firstId = billIds[0];
    if (firstId != null) flash(firstId);
  }

  async function handleConfirmPay() {
    if (confirmPayBillId == null) return;
    setActionError(null);
    setPaying(true);
    try {
      await payBillRequest(confirmPayBillId);
      await queryClient.invalidateQueries({ queryKey: taxationKeys.bills() });
      flash(confirmPayBillId);
      setConfirmPayBillId(null);
      // Close the detail modal too — bill is now paid, the in-modal
      // Pay action shouldn't linger after success.
      viewModal.close();
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to pay bill'));
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="text-sm text-slate-500 dark:text-slate-400">
            <Link
              to="/dashboard"
              className="text-indigo-600 hover:underline dark:text-indigo-300"
            >
              Dashboard
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-700 dark:text-slate-200">
              Tax Tracker
            </span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Tax Tracker
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Watch tax accrue in the in-progress week, review penalty
            breakdowns on finalized bills, and generate bills for past
            weeks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGenerateOpen(true)}
          className="btn-primary !w-auto"
          data-testid="generate-bills-button"
        >
          Generate / refresh bills
        </button>
      </header>

      {(error || actionError) && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {actionError ?? 'Failed to load bills.'}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <CurrentWeekTracker />

        <section
          aria-labelledby="bills-heading"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2
              id="bills-heading"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Bills
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {bills.length} {bills.length === 1 ? 'bill' : 'bills'}
            </span>
          </div>

          {isLoading && bills.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Loading…
            </div>
          ) : bills.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No bills yet. Use <strong>Generate / refresh bills</strong>{' '}
              above to generate bills for a past week.
            </div>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="bills-list">
              {bills.map((b) => (
                <BillRow
                  key={b.bill_id}
                  bill={b}
                  isHighlighted={highlightBillId === b.bill_id}
                  money={money}
                  timezone={timezone}
                  onView={(id) => viewModal.openWith(String(id))}
                  onPay={(id) => setConfirmPayBillId(id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <GenerateBillsDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={handleGenerated}
        timezone={timezone}
      />

      <BillDetailDialog
        billId={viewBillId}
        open={viewBillId != null}
        onClose={viewModal.close}
        onPay={(id) => setConfirmPayBillId(id)}
        onViewTransaction={(txnId) => {
          viewModal.close();
          navigate(`/transactions?edit=${txnId}`);
        }}
      />

      <ConfirmDialog
        open={confirmPayBillId != null}
        title="Mark bill as paid"
        message="This records the bill as paid and creates the corresponding consumption-tax transaction. Continue?"
        confirmLabel="Mark paid"
        intent="primary"
        busy={paying}
        onClose={() => setConfirmPayBillId(null)}
        onConfirm={handleConfirmPay}
      />
    </div>
  );
}

interface BillRowProps {
  bill: BillSummary;
  isHighlighted: boolean;
  money: (n: number | null | undefined) => string;
  timezone: string;
  onView: (billId: number) => void;
  onPay: (billId: number) => void;
}

// Bill row: View + Pay live on the same action line on every viewport
// (per the 2026-05-26 design lock). At narrow viewports the row wraps
// the action cluster below the date+status block via `flex-wrap`.
function BillRow({
  bill,
  isHighlighted,
  money,
  timezone,
  onView,
  onPay,
}: BillRowProps) {
  const ringClass = isHighlighted
    ? 'ring-2 ring-inset ring-indigo-500'
    : 'ring-0';
  return (
    <li
      data-testid={`bill-row-${bill.bill_id}`}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 transition-shadow dark:border-slate-800 dark:bg-slate-900 ${ringClass}`}
    >
      <div className="min-w-0">
        <div className="font-semibold text-slate-900 dark:text-slate-100">
          {formatBillDate(bill.period_start, timezone)} →{' '}
          {formatBillDate(bill.period_end, timezone)}
        </div>
        <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          <StatusPill status={bill.status} />
          <span className="ml-2 tabular-nums money">{money(bill.amount)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onView(bill.bill_id)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
        >
          View
        </button>
        {bill.status === 'pending' && (
          <button
            type="button"
            onClick={() => onPay(bill.bill_id)}
            className="btn-primary !w-auto"
          >
            Pay
          </button>
        )}
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: BillStatus }) {
  const tone =
    status === 'paid'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
      : status === 'pending'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}
    >
      {status}
    </span>
  );
}
