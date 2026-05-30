import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { formatYearMonth } from '../../../shared/utils/dateUtils';
import {
  useBudgetStatusQuery,
  type BudgetCategory,
} from '../../budgets/api/queries';

import { DashboardCard, DashboardCardEmpty } from './DashboardCard';
import { WeekByCategoryStrip } from './WeekByCategoryStrip';

// Dashboard snapshot of the current month's budget vs. actual. Bespoke
// (not a reuse of BudgetCategoryCard) — the page card pairs each
// category with a full label/value strip; the dashboard card needs
// a denser top-3 list so the triptych stays balanced.
//
// Surface contents:
//  • Total Spent / Limit + a single progress bar (the page's
//    "Month Overview" rolled up).
//  • Top 3 categories with the highest current spend (filtered to
//    those with either spend > 0 OR a configured limit).
//  • Breach count chip when any category is over its limit.
//  • Footer deep-link → /budgets.
const TOP_CATEGORIES_LIMIT = 3;

// A category is worth showing if it has spend or a configured limit.
function isActiveCategory(c: BudgetCategory): boolean {
  return (c.current_expense ?? 0) > 0 || (c.limit_amt != null && c.limit_amt > 0);
}

// Breached = has a positive limit and spend exceeds it.
function isBreachedCategory(c: BudgetCategory): boolean {
  return (
    c.limit_amt != null && c.limit_amt > 0 && (c.current_expense ?? 0) > c.limit_amt
  );
}

// View-model: owns the query and all derived state (visible/sorted
// categories, breach count, and the loading/empty branch flags) so the
// component itself stays a thin render. Keeping the `??`/`||` plumbing
// here is what keeps ExpenseTrackerCard's cyclomatic complexity in check.
interface ExpenseTrackerView {
  showLoading: boolean;
  showEmpty: boolean;
  total: BudgetCategory | null;
  visibleCategories: BudgetCategory[];
  breachCount: number;
  month: string | undefined;
}

function useExpenseTrackerView(): ExpenseTrackerView {
  const { data, isLoading } = useBudgetStatusQuery(null);

  const visibleCategories = useMemo<BudgetCategory[]>(() => {
    const cats = data?.categories ?? [];
    return cats
      .filter(isActiveCategory)
      .sort((a, b) => (b.current_expense ?? 0) - (a.current_expense ?? 0));
  }, [data]);

  const breachCount = useMemo(
    () => visibleCategories.filter(isBreachedCategory).length,
    [visibleCategories]
  );

  const total = data?.total_budget ?? null;
  const hasAnySpend =
    (total?.current_expense ?? 0) > 0 || visibleCategories.length > 0;
  const hasAnyLimit =
    (total?.limit_amt ?? 0) > 0 ||
    visibleCategories.some((c) => (c.limit_amt ?? 0) > 0);

  return {
    showLoading: isLoading && !data,
    showEmpty: !hasAnySpend && !hasAnyLimit,
    total,
    visibleCategories,
    breachCount,
    month: data?.month,
  };
}

export function ExpenseTrackerCard() {
  const { money } = useMoneyFormatter();
  const { showLoading, showEmpty, total, visibleCategories, breachCount, month } =
    useExpenseTrackerView();

  if (showLoading) {
    return (
      <DashboardCard
        title="Expense Tracker"
        testId="dashboard-expense-card"
      >
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      </DashboardCard>
    );
  }

  // Fresh-signup state: no spend and no configured limits. CTA invites
  // the user to set their first budget. Once they add spend (even
  // without a limit) the populated view takes over and a softer
  // "Set a budget to track headroom" hint shows beneath the rollup.
  if (showEmpty) {
    return (
      <DashboardCard
        title="Expense Tracker"
        pending
        testId="dashboard-expense-card"
      >
        <DashboardCardEmpty
          headline="No budgets configured"
          body="Set a monthly limit per category to see headroom and breach warnings here."
          ctaHref="/budgets"
          ctaLabel="Set your first budget"
        />
      </DashboardCard>
    );
  }

  const titleChip = breachCount > 0 ? (
    <span
      className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
      data-testid="dashboard-expense-breach-chip"
    >
      {breachCount} over budget
    </span>
  ) : (
    formatYearMonth(month, 'short')
  );

  return (
    <DashboardCard
      title="Expense Tracker"
      titleChip={titleChip}
      footerHref="/budgets"
      footerLabel="View all categories"
      testId="dashboard-expense-card"
    >
      <TotalRollup category={total} money={money} />

      {visibleCategories.length > 0 ? (
        <>
          <div className="mt-4 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Top categories this month
          </div>
          <ul
            className="mt-2 flex flex-col gap-3"
            data-testid="dashboard-expense-category-list"
          >
            {visibleCategories.slice(0, TOP_CATEGORIES_LIMIT).map((cat) => (
              <CategoryRow key={cat.tag_id} category={cat} money={money} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          No category spend yet this month.
        </p>
      )}

      {/*
       * Week-by-category strip — Batch 9.5. Sits below the month top-3
       * list so the user sees "where money went this week" alongside
       * the existing monthly view. Hides itself silently when there's
       * no weekly spend.
       */}
      <WeekByCategoryStrip />
    </DashboardCard>
  );
}

interface TotalRollupProps {
  category: BudgetCategory | null;
  money: (n: number | null | undefined) => string;
}

function TotalRollup({ category, money }: TotalRollupProps) {
  const current = category?.current_expense ?? 0;
  const limit = category?.limit_amt ?? 0;
  const hasLimit = limit > 0;
  const percent = hasLimit ? (current / limit) * 100 : 0;
  const status = statusFor(percent, hasLimit);
  const style = STATUS_STYLE[status];

  return (
    <div data-testid="dashboard-expense-rollup">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Spent this month
          </div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900 money dark:text-slate-100">
            {money(current)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Monthly limit
          </div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700 money dark:text-slate-200">
            {hasLimit ? money(limit) : '—'}
          </div>
        </div>
      </div>

      {hasLimit ? (
        <div className="mt-3" data-testid={`dashboard-expense-progress-${status}`}>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className={`h-full transition-[width] duration-300 ${style.bar}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs">
            <span className={`font-medium tabular-nums ${style.text}`}>
              {percent.toFixed(0)}% used
            </span>
            <span className={`font-semibold ${style.text}`}>{style.label}</span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          No total limit configured —{' '}
          <span className="font-medium text-indigo-600 dark:text-indigo-300">
            set one
          </span>{' '}
          to track monthly headroom.
        </p>
      )}
    </div>
  );
}

interface CategoryRowProps {
  category: BudgetCategory;
  money: (n: number | null | undefined) => string;
}

function CategoryRow({ category, money }: CategoryRowProps) {
  const current = category.current_expense ?? 0;
  const limit = category.limit_amt ?? 0;
  const hasLimit = limit > 0;
  const percent = hasLimit ? (current / limit) * 100 : 0;
  const status = statusFor(percent, hasLimit);
  const style = STATUS_STYLE[status];

  return (
    <li
      data-testid={`dashboard-expense-category-${category.tag_id}`}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium text-slate-800 dark:text-slate-100">
          {category.tag_name}
        </span>
        <span className="ml-2 shrink-0 tabular-nums text-slate-600 money dark:text-slate-300">
          {money(current)}
          {hasLimit && (
            <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
              / {money(limit)}
            </span>
          )}
        </span>
      </div>
      {hasLimit ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full ${style.bar}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      ) : (
        <div className="text-xs text-slate-400 dark:text-slate-500">
          No limit set
        </div>
      )}
    </li>
  );
}

type ProgressStatus = 'safe' | 'watch' | 'near' | 'over' | 'unset';

function statusFor(percent: number, hasLimit: boolean): ProgressStatus {
  if (!hasLimit) return 'unset';
  if (percent > 100) return 'over';
  if (percent >= 85) return 'near';
  if (percent >= 60) return 'watch';
  return 'safe';
}

// Locked thresholds match BudgetCategoryCard for visual consistency
// across the budgets surface and the dashboard snapshot.
const STATUS_STYLE: Record<
  ProgressStatus,
  { bar: string; text: string; label: string }
> = {
  safe: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'On track',
  },
  watch: {
    bar: 'bg-amber-500 dark:bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Watch',
  },
  near: {
    bar: 'bg-orange-500 dark:bg-orange-400',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'Near limit',
  },
  over: {
    bar: 'bg-rose-500 dark:bg-rose-400',
    text: 'text-rose-700 dark:text-rose-300',
    label: 'Over budget',
  },
  unset: {
    bar: 'bg-slate-300 dark:bg-slate-700',
    text: 'text-slate-500 dark:text-slate-400',
    label: 'No limit',
  },
};
