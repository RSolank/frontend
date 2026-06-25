import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { CountUpNumber } from '../../../shared/components/CountUpNumber';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { useTransactionsQuery } from '../../transactions/api/queries';
import type { TransactionDTO } from '../../transactions/api/schemas';

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
  const timezone = usePreferencesStore((s) => s.timezone);
  const { money } = useMoneyFormatter();

  const week = useMemo(() => weekRangeInTz(new Date(), timezone), [timezone]);
  // If the week's start month differs from its end month we fall back
  // to the unbounded fetch so neither half is missed.
  const weekCrossesMonth =
    week.period_start.slice(0, 7) !== week.period_end.slice(0, 7);
  const activeMonth = weekCrossesMonth
    ? undefined
    : week.period_start.slice(0, 7);

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
      (t) =>
        t.txn_date >= week.period_start &&
        t.txn_date <= `${week.period_end}T23:59:59`
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
    <TransactionsCardView
      recentTxns={recentTxns}
      weekTotal={weekTotal}
      weekCount={weekCount}
      money={money}
      timezone={timezone}
      titleChip={titleChip}
    />
  );
}

interface TxnViewProps {
  recentTxns: TransactionDTO[];
  weekTotal: number;
  weekCount: number;
  money: (n: number | string | null | undefined) => string;
  timezone: string;
  titleChip: ReactNode;
  // Display-only (the landing showcase): drop the navigating affordances — the
  // "View all" footer link and the inline "Add transaction" CTA — so the card is
  // a pure, non-interactive mock.
  displayOnly?: boolean;
}

// Pure populated card — split out of the fetching container so the landing
// showcase can mount it with fabricated transactions (no-drift with the real
// dashboard card). The empty/loading states stay in the container.
export function TransactionsCardView({
  recentTxns,
  weekTotal,
  weekCount,
  money,
  timezone,
  titleChip,
  displayOnly = false,
}: TxnViewProps) {
  return (
    <DashboardCard
      title="Transactions"
      titleChip={titleChip}
      footerHref="/transactions"
      footerLabel="View all"
      footerAsText={displayOnly}
      testId="dashboard-transactions-card"
    >
      {/* Stat strip — weekly spend + count of debits. money class is
          required for the privacy-mask toggle per CONTRIBUTING §6. */}
      <dl className="mb-3 grid grid-cols-2 gap-2">
        <Stat
          label="Spent this week"
          value={weekTotal}
          format={money}
          accent
          isMoney
          testId="dashboard-transactions-week-total"
        />
        <Stat
          label="Debits this week"
          value={weekCount}
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
                  {t.beneficiary_name || '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(t.txn_date, timezone)}
                </div>
              </div>
              <span
                className={`money shrink-0 text-sm font-semibold tabular-nums ${
                  isDebit
                    ? 'text-danger-700 dark:text-danger-300'
                    : 'text-success-700 dark:text-success-300'
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
       * In display-only mode (the landing mock) it stays VISIBLE — same shared
       * classes, so no drift from the dashboard — but renders as an inert span
       * (no navigation, no pointer interaction) instead of a Link.
       */}
      <div className="mt-3">
        {displayOnly ? (
          <span
            aria-disabled="true"
            className={`${ADD_CTA_CLASS} pointer-events-none`}
          >
            Add transaction
          </span>
        ) : (
          <Link
            to="/transactions?add=true"
            className={ADD_CTA_CLASS}
            data-testid="dashboard-transactions-add-cta"
          >
            Add transaction
          </Link>
        )}
      </div>
    </DashboardCard>
  );
}

// Shared styling for the "Add transaction" affordance so the display-only span
// (landing) and the real Link (dashboard) can never visually drift.
const ADD_CTA_CLASS =
  'border-accent-200 bg-accent-50 text-accent-700 hover:border-accent-300 hover:bg-accent-100 focus-visible:ring-accent-500 dark:border-accent-900 dark:bg-accent-950/50 dark:text-accent-200 dark:hover:bg-accent-950/70 inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none';

interface StatProps {
  label: string;
  // A summary accumulation (weekly spend, debit count) — counts up. These are
  // headline figures, not a list, so the count-up reads as meaningful.
  value: number;
  format?: (n: number) => string;
  accent?: boolean;
  // Money values get the `money` class so the privacy-mask toggle
  // blurs them. Non-money values (counts) opt out.
  isMoney?: boolean;
  testId?: string;
}

function Stat({ label, value, format, accent, isMoney, testId }: StatProps) {
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        accent
          ? 'bg-accent-50 dark:bg-accent-950/40'
          : 'bg-slate-50 dark:bg-slate-800/60'
      }`}
      data-testid={testId}
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <CountUpNumber
        value={value}
        format={format}
        className={`mt-0.5 block text-base font-semibold tabular-nums ${
          isMoney ? 'money' : ''
        } ${
          accent
            ? 'text-accent-700 dark:text-accent-200'
            : 'text-slate-900 dark:text-slate-100'
        }`}
      />
    </div>
  );
}
