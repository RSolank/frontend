import { CalendarClock } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { formatDisplayDate } from '../../../shared/utils/dateUtils';
import { useBeneficiariesQuery } from '../../beneficiaries/api/queries';
import { useRecurringUpcomingQuery } from '../../recurring/api/queries';
import type { RecurringBill } from '../../recurring/api/schemas';

// BE Phase 1.5 — Dashboard "Upcoming bills" widget. Renders the next
// 7 days of forecast bills from `/api/recurring/upcoming?days=7`. The
// row markup is intentionally inlined here (instead of reaching into
// `features/recurring/components`) because the eslint boundaries
// rule restricts dashboard to other features' `api/` surface only;
// the /recurring management page renders its own UpcomingBillsList
// for the 30-day tab. Drift between the two is acceptable for a
// 30-line list view; if a third consumer materialises, promote the
// list to shared/.
const WIDGET_DAYS = 7;
const MAX_ROWS = 5;

export function UpcomingBillsWidget() {
  const navigate = useNavigate();
  const { money } = useMoneyFormatter();
  const upcoming = useRecurringUpcomingQuery(WIDGET_DAYS);
  const benQuery = useBeneficiariesQuery();
  const benData = benQuery.data;
  const benNames = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of benData ?? []) m.set(b.uid, b.name);
    return m;
  }, [benData]);

  const bills = (upcoming.data ?? []).slice(0, MAX_ROWS);
  const hasMore = (upcoming.data?.length ?? 0) > MAX_ROWS;

  return (
    <section
      data-testid="dashboard-upcoming"
      aria-labelledby="upcoming-heading"
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3
          id="upcoming-heading"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          <CalendarClock size={14} aria-hidden className="text-indigo-500" />
          Upcoming bills · 7d
        </h3>
        <button
          type="button"
          onClick={() => navigate('/recurring')}
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Manage
        </button>
      </header>
      <UpcomingBody
        isLoading={upcoming.isLoading}
        bills={bills}
        benNames={benNames}
        money={money}
        hasMore={hasMore}
      />
    </section>
  );
}

interface BodyProps {
  isLoading: boolean;
  bills: RecurringBill[];
  benNames: Map<number, string>;
  money: (n: number | string | null | undefined) => string;
  hasMore: boolean;
}

function UpcomingBody({ isLoading, bills, benNames, money, hasMore }: BodyProps) {
  if (isLoading)
    return (
      <p className="text-sm text-slate-500" data-testid="dashboard-upcoming-loading">
        Loading…
      </p>
    );
  if (bills.length === 0)
    return (
      <p
        className="text-sm text-slate-500"
        data-testid="dashboard-upcoming-empty"
      >
        Nothing forecast in the next 7 days.
      </p>
    );
  return (
    <>
      <ul className="flex flex-col gap-1.5" data-testid="dashboard-upcoming-list">
        {bills.map((bill) => (
          <UpcomingRow
            key={bill.uid}
            bill={bill}
            beneficiaryName={
              benNames.get(bill.beneficiary_id) ??
              `Beneficiary #${bill.beneficiary_id}`
            }
            moneyLabel={money(bill.expected_amount)}
          />
        ))}
      </ul>
      {hasMore && (
        <p className="mt-2 text-right text-xs text-slate-500">
          + more in /recurring
        </p>
      )}
    </>
  );
}

function UpcomingRow({
  bill,
  beneficiaryName,
  moneyLabel,
}: {
  bill: RecurringBill;
  beneficiaryName: string;
  moneyLabel: string;
}) {
  return (
    <li
      className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm dark:bg-slate-800/50"
      data-testid={`dashboard-upcoming-row-${bill.uid}`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
          {beneficiaryName}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatDisplayDate(bill.due_date)}
        </span>
      </div>
      <span
        className={`money shrink-0 text-sm font-medium ${
          bill.debit_credit === 'debit'
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {bill.debit_credit === 'debit' ? '-' : '+'}
        {moneyLabel}
      </span>
    </li>
  );
}
