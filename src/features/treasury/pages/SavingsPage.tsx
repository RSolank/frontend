import { Link } from 'react-router-dom';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { useTreasurySummaryQuery } from '../api/queries';
import { SavingsComposition } from '../components/SavingsComposition';
import { SavingsHeadline } from '../components/SavingsHeadline';
import { SavingsTrend } from '../components/SavingsTrend';

// The Savings page — the income side of the treasury (the committee's revenue
// books). User-facing label is "Savings"; the route + feature stay `treasury`.
// It reads the reconcile-on-read `/treasury/summary` and lays out three zones:
// the headline (set aside · owed · coverage), the recognized/deferred
// composition, and the cumulative trend. Income-side only for now — the
// expense (investments) side slots in below later. Components are kept pure so
// the A1b dashboard hero can mount the headline + trend with the same data.
export function SavingsPage() {
  const { money } = useMoneyFormatter();
  const { data, isLoading, error } = useTreasurySummaryQuery();

  // True empty state — a user who has neither set anything aside nor had any
  // tax levied yet. (funded > 0 with provisioned 0, or vice versa, is a real
  // in-progress state and renders the zones.)
  const isEmpty =
    data != null &&
    data.funded_balance === 0 &&
    data.provisioned_total === 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <nav className="text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/dashboard"
            className="text-accent-600 dark:text-accent-300 hover:underline"
          >
            Dashboard
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700 dark:text-slate-200">Savings</span>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Savings
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Money your future self has set aside — the self-tax you provision on
          taxable spending, banked toward what comes next. Allocated against the
          bills it was levied for, with any surplus held in advance.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
        >
          Failed to load your savings summary.
        </div>
      )}

      {isLoading && !data && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      )}

      {isEmpty && <EmptyState />}

      {data && !isEmpty && (
        <div className="flex flex-col gap-4">
          <SavingsHeadline
            fundedBalance={data.funded_balance}
            provisionedTotal={data.provisioned_total}
            money={money}
          />
          {data.funded_balance > 0 && (
            <SavingsComposition
              recognized={data.recognized_revenue}
              deferred={data.deferred_balance}
              money={money}
            />
          )}
          <SavingsTrend trend={data.trend} />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center dark:border-slate-700"
      data-testid="savings-empty-state"
    >
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Nothing set aside yet
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
        As your taxable spending accrues a self-tax and you move that money into
        your savings account, it shows up here — allocated against the bills it
        was levied for.
      </p>
      <Link
        to="/consumption-tax"
        className="text-accent-600 dark:text-accent-300 mt-3 inline-block text-sm font-medium hover:underline"
      >
        Go to Tax Tracker →
      </Link>
    </div>
  );
}
