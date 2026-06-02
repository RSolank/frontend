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
import { markBillPaidRequest, markBillUnpaidRequest } from '../api/mutations';
import { useBillsQuery, type BillSummary } from '../api/queries';
import { BillDetailDialog } from '../components/BillDetailDialog';
import {
  BillStatusPill,
  isPayable,
  isUnpayable,
} from '../components/billStatus';
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

// ConfirmDialog copy keyed off the active mode — extracted so the
// page render stays under the §3 complexity ceiling.
interface ConfirmCopy {
  title: string;
  message: string;
  label: string;
  intent: 'primary' | 'danger';
}

function confirmCopy(mode: 'paid' | 'unpaid' | undefined): ConfirmCopy {
  if (mode === 'unpaid') {
    return {
      title: 'Reopen this bill?',
      message:
        'This clears the paid status and reverts any manual allocation against this bill. The engine will redirect auto-FIFO allocations to the oldest outstanding bill on the next worker run. Continue?',
      label: 'Reopen',
      intent: 'danger',
    };
  }
  return {
    title: 'Mark bill as paid',
    message:
      'This records that you settled this bill outside the app (the engine does not create a transaction). Continue?',
    label: 'Mark paid',
    intent: 'primary',
  };
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

  // Two confirm flows in flight: mark-paid (most common) and
  // mark-unpaid (the undo path). One `useState` covers both because
  // the dialog is single-instance — `mode` decides copy + handler.
  const [confirmBill, setConfirmBill] = useState<
    { bill_id: number; mode: 'paid' | 'unpaid' } | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { id: highlightBillId, flash } = useRowHighlight<number>();

  async function handleGenerated(billIds: number[]) {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: taxationKeys.bills() });
    const firstId = billIds[0];
    if (firstId != null) flash(firstId);
  }

  async function handleConfirm() {
    if (confirmBill == null) return;
    setActionError(null);
    setSubmitting(true);
    try {
      if (confirmBill.mode === 'paid') {
        await markBillPaidRequest(confirmBill.bill_id);
      } else {
        await markBillUnpaidRequest(confirmBill.bill_id);
      }
      await queryClient.invalidateQueries({ queryKey: taxationKeys.bills() });
      // Detail query for this bill also needs to reload so the in-modal
      // surface reflects the new state if the user just acted from
      // inside the modal.
      await queryClient.invalidateQueries({
        queryKey: taxationKeys.billDetail(confirmBill.bill_id),
      });
      flash(confirmBill.bill_id);
      setConfirmBill(null);
      // Mark-paid closes the detail modal (action complete); mark-unpaid
      // leaves it open so the user can review the reopened bill.
      if (confirmBill.mode === 'paid') viewModal.close();
    } catch (err) {
      setActionError(
        errorMessage(
          err,
          confirmBill.mode === 'paid'
            ? 'Failed to mark bill paid'
            : 'Failed to reopen bill'
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Bills list via early returns (loading / empty / list) instead of a nested
  // ternary in the JSX — keeps it off sonarjs/no-nested-conditional.
  function renderBillsList() {
    if (isLoading && bills.length === 0) {
      return (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      );
    }
    if (bills.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No bills yet. Use <strong>Generate / refresh bills</strong>{' '}
          above to generate bills for a past week.
        </div>
      );
    }
    return (
      <ul className="flex flex-col gap-2" data-testid="bills-list">
        {bills.map((b) => (
          <BillRow
            key={b.bill_id}
            bill={b}
            isHighlighted={highlightBillId === b.bill_id}
            money={money}
            timezone={timezone}
            onView={(id) => viewModal.openWith(String(id))}
            onMarkPaid={(id) => setConfirmBill({ bill_id: id, mode: 'paid' })}
            onMarkUnpaid={(id) =>
              setConfirmBill({ bill_id: id, mode: 'unpaid' })
            }
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="text-sm text-slate-500 dark:text-slate-400">
            <Link
              to="/dashboard"
              className="text-accent-600 hover:underline dark:text-accent-300"
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

          {renderBillsList()}
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
        onMarkPaid={(id) => setConfirmBill({ bill_id: id, mode: 'paid' })}
        onMarkUnpaid={(id) => setConfirmBill({ bill_id: id, mode: 'unpaid' })}
        onViewTransaction={(txnId) => {
          viewModal.close();
          navigate(`/transactions?edit=${txnId}`);
        }}
      />

      <ConfirmDialog
        open={confirmBill != null}
        title={confirmCopy(confirmBill?.mode).title}
        message={confirmCopy(confirmBill?.mode).message}
        confirmLabel={confirmCopy(confirmBill?.mode).label}
        intent={confirmCopy(confirmBill?.mode).intent}
        busy={submitting}
        onClose={() => setConfirmBill(null)}
        onConfirm={handleConfirm}
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
  onMarkPaid: (billId: number) => void;
  onMarkUnpaid: (billId: number) => void;
}

// Bill row: View + (Mark paid | Reopen) live on the same action line on
// every viewport (per the 2026-05-26 design lock). At narrow viewports
// the row wraps the action cluster below the date+status block via
// `flex-wrap`. Partial payments surface an `amount_paid / amount`
// progress bar inline so the user reads the settlement state without
// opening the detail modal.
function BillRow({
  bill,
  isHighlighted,
  money,
  timezone,
  onView,
  onMarkPaid,
  onMarkUnpaid,
}: BillRowProps) {
  const ringClass = isHighlighted
    ? 'ring-2 ring-inset ring-accent-500'
    : 'ring-0';
  const paid = bill.amount_paid ?? 0;
  const total = bill.amount ?? 0;
  const showProgress =
    total > 0 && paid > 0 && paid < total && bill.status !== 'PAID';
  return (
    <li
      data-testid={`bill-row-${bill.bill_id}`}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 transition-shadow dark:border-slate-800 dark:bg-slate-900 ${ringClass}`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 dark:text-slate-100">
          {formatBillDate(bill.period_start, timezone)} →{' '}
          {formatBillDate(bill.period_end, timezone)}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <BillStatusPill status={bill.status} />
          <span className="tabular-nums money">{money(total)}</span>
          {showProgress && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              · <span className="money tabular-nums">{money(paid)}</span> paid
            </span>
          )}
        </div>
        {showProgress && (
          <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-success-500 dark:bg-success-400"
              style={{ width: `${Math.min((paid / total) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onView(bill.bill_id)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-accent-300 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-accent-700 dark:hover:text-accent-300"
        >
          View
        </button>
        {isPayable(bill.status) && (
          <button
            type="button"
            onClick={() => onMarkPaid(bill.bill_id)}
            className="btn-primary !w-auto"
            data-testid={`bill-mark-paid-${bill.bill_id}`}
          >
            Mark paid
          </button>
        )}
        {isUnpayable(bill.status) && (
          <button
            type="button"
            onClick={() => onMarkUnpaid(bill.bill_id)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-danger-300 hover:text-danger-700 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-danger-800 dark:hover:text-danger-300"
            data-testid={`bill-mark-unpaid-${bill.bill_id}`}
          >
            Reopen
          </button>
        )}
      </div>
    </li>
  );
}
