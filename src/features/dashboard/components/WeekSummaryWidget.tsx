import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { useTrackerCurrentWeekQuery } from '../../taxation/api/queries';
import { useTransactionsQuery } from '../../transactions/api/queries';

// "This week" mini-summary — single-card surface in the secondary
// column with the active week range + 1-line totals (spend, debit
// count, running tax). Sits below BreachAlertsWidget on desktop.
//
// Reuses the same query slices the primary cards already pull, so
// the React Query cache is shared and this widget pays no extra
// network cost.
const WEEK_FETCH_LIMIT = 200;

export function WeekSummaryWidget() {
  const timezone = usePreferencesStore((s) => s.timezone);
  const { money } = useMoneyFormatter();

  const week = useMemo(() => weekRangeInTz(new Date(), timezone), [timezone]);
  const weekCrossesMonth =
    week.period_start.slice(0, 7) !== week.period_end.slice(0, 7);
  const activeMonth = weekCrossesMonth
    ? undefined
    : week.period_start.slice(0, 7);

  const txnQuery = useTransactionsQuery({
    limit: WEEK_FETCH_LIMIT,
    offset: 0,
    sort_by: 'date',
    order: 'desc',
    debit_credit: 'debit',
    ...(activeMonth ? { month: activeMonth } : {}),
  });
  const trackerQuery = useTrackerCurrentWeekQuery();

  const weekDebits = useMemo(() => {
    const all = txnQuery.data?.transactions ?? [];
    return all.filter(
      (t) =>
        t.txn_date >= week.period_start &&
        t.txn_date <= `${week.period_end}T23:59:59`
    );
  }, [txnQuery.data, week]);

  const weekSpend = weekDebits.reduce(
    (acc, t) => acc + (Number(t.amount) || 0),
    0
  );
  const runningTax =
    (trackerQuery.data?.running_tax ?? 0) +
    (trackerQuery.data?.running_penalty ?? 0);

  return (
    <section
      data-testid="dashboard-week-summary"
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          This week
        </h3>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {formatDate(`${week.period_start}T12:00:00Z`, timezone, {
            month: 'short',
            day: 'numeric',
          })}
          {' → '}
          {formatDate(`${week.period_end}T12:00:00Z`, timezone, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </header>
      <dl className="flex flex-col gap-1 text-xs">
        <Row label="Spent" value={money(weekSpend)} isMoney />
        <Row label="Debits" value={String(weekDebits.length)} />
        <Row
          label="Tax accrued"
          value={trackerQuery.data == null ? '—' : money(runningTax)}
          isMoney={trackerQuery.data != null}
        />
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  isMoney,
}: {
  label: string;
  value: string;
  isMoney?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={`font-semibold text-slate-800 tabular-nums dark:text-slate-100 ${
          isMoney ? 'money' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
