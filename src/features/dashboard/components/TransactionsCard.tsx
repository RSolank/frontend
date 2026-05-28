import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatMoney } from '../../../shared/utils/currency';
import { formatDate } from '../../../shared/utils/dateUtils';
import { useCurrenciesQuery } from '../../metadata/api/queries';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { useTransactionsQuery } from '../../transactions/api/queries';

import { DashboardCard, DashboardCardEmpty } from './DashboardCard';

// Dashboard's Transactions snapshot. Bespoke (not a reuse of the
// TransactionsPage table) — the page table is filterable + paginated;
// the Dashboard card is a glance view with a weekly aggregate header
// + the 5 most recent debits + a deep-link footer.
//
// Two query slices:
//   1. Recent list — limit 5, sorted desc by date. Drives the row list.
//   2. This-week aggregate — fetch the current month's debits and
//      filter client-side to the active ISO Mon–Sun week. Cheap enough
//      (one month bounded) and avoids a backend endpoint that
//      doesn't exist yet.
//
// `month=YYYY-MM` is the only date filter the transactions list
// endpoint supports today; if the active week straddles a month
// boundary the early-week days fall in the previous month and the
// aggregate would understate. Edge case acknowledged — we fall back
// to a slightly wider unbounded fetch (limit 200, no month filter)
// when the active week crosses months. Cheap insurance.
const RECENT_LIMIT = 5;
const WEEK_FETCH_LIMIT = 200;

export function TransactionsCard() {
  const currencyCode = usePreferencesStore((s) => s.currency);
  const timezone = usePreferencesStore((s) => s.timezone);
  const { data: currencies } = useCurrenciesQuery();
  const currencySymbol = useMemo(
    () => currencies?.find((c) => c.code === currencyCode)?.symbol ?? null,
    [currencies, currencyCode]
  );
  const money = (n: number | null | undefined) =>
    formatMoney(n ?? 0, currencyCode, currencySymbol);

  const week = useMemo(() => weekRangeInTz(new Date(), timezone), [timezone]);
  // If the week's start month differs from its end month we fall back
  // to the unbounded fetch so neither half is missed.
  const weekCrossesMonth =
    week.period_start.slice(0, 7) !== week.period_end.slice(0, 7);
  const activeMonth = weekCrossesMonth ? undefined : week.period_start.slice(0, 7);

  const recentQuery = useTransactionsQuery({
    limit: RECENT_LIMIT,
    offset: 0,
    sort_by: 'date',
    order: 'desc',
  });
  const weekQuery = useTransactionsQuery({
    limit: WEEK_FETCH_LIMIT,
    offset: 0,
    sort_by: 'date',
    order: 'desc',
    debit_credit: 'debit',
    ...(activeMonth ? { month: activeMonth } : {}),
  });

  const recentTxns = recentQuery.data?.transactions ?? [];
  const weekDebits = useMemo(() => {
    const all = weekQuery.data?.transactions ?? [];
    return all.filter(
      (t) => t.txn_date >= week.period_start && t.txn_date <= `${week.period_end}T23:59:59`
    );
  }, [weekQuery.data, week]);
  const weekTotal = useMemo(
    () => weekDebits.reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
    [weekDebits]
  );
  const weekCount = weekDebits.length;

  const titleChip = (
    <>
      {formatDate(`${week.period_start}T12:00:00Z`, timezone, {
        month: 'short',
        day: 'numeric',
      })}
      {' → '}
      {formatDate(`${week.period_end}T12:00:00Z`, timezone, {
        month: 'short',
        day: 'numeric',
      })}
    </>
  );

  if (
    !recentQuery.isLoading &&
    !weekQuery.isLoading &&
    recentTxns.length === 0
  ) {
    return (
      <DashboardCard
        title="Transactions"
        titleChip={titleChip}
        pending
        testId="dashboard-transactions-card"
      >
        <DashboardCardEmpty
          headline="No transactions yet"
          body="Add your first transaction to start tracking expenses and accruing tax."
          ctaHref="/transactions?add=true"
          ctaLabel="Add transaction"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Transactions"
      titleChip={titleChip}
      footerHref="/transactions"
      footerLabel="View all"
      testId="dashboard-transactions-card"
    >
      {/* Stat strip — weekly spend + count of debits. money class is
          required for the privacy-mask toggle per CONTRIBUTING §6. */}
      <dl className="mb-3 grid grid-cols-2 gap-2">
        <Stat
          label="Spent this week"
          value={money(weekTotal)}
          accent
          isMoney
          testId="dashboard-transactions-week-total"
        />
        <Stat
          label="Debits this week"
          value={String(weekCount)}
          testId="dashboard-transactions-week-count"
        />
      </dl>

      <ul
        className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800"
        data-testid="dashboard-transactions-list"
      >
        {recentTxns.map((t) => {
          const isDebit = t.debit_credit === 'debit';
          return (
            <li
              key={t.txn_id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {t.beneficiary_name || t.beneficiary || '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(t.txn_date, timezone)}
                </div>
              </div>
              <span
                className={`tabular-nums money shrink-0 text-sm font-semibold ${
                  isDebit
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {isDebit ? '-' : '+'}
                {money(t.amount)}
              </span>
            </li>
          );
        })}
      </ul>

      {/*
       * Inline "Add transaction" affordance — also surfaced via the
       * card footer's destination page, but having the CTA inline
       * matches the design choice 'every card gets a primary action'.
       */}
      <div className="mt-3">
        <Link
          to="/transactions?add=true"
          className="inline-flex w-full items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950/70"
          data-testid="dashboard-transactions-add-cta"
        >
          Add transaction
        </Link>
      </div>
    </DashboardCard>
  );
}

interface StatProps {
  label: string;
  value: string;
  accent?: boolean;
  // Money values get the `money` class so the privacy-mask toggle
  // blurs them. Non-money values (counts) opt out.
  isMoney?: boolean;
  testId?: string;
}

function Stat({ label, value, accent, isMoney, testId }: StatProps) {
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        accent
          ? 'bg-indigo-50 dark:bg-indigo-950/40'
          : 'bg-slate-50 dark:bg-slate-800/60'
      }`}
      data-testid={testId}
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-base font-semibold tabular-nums ${
          isMoney ? 'money' : ''
        } ${
          accent
            ? 'text-indigo-700 dark:text-indigo-200'
            : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
