import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { useAuthStore } from '../../../shared/state/auth.store';
import { formatYearMonth } from '../../../shared/utils/dateUtils';
import { useExpenseTrendQuery } from '../../dashboard/api/queries';
import type { BudgetCategory } from '../api/queries';

import { BudgetSignal } from './BudgetSignal';
import { SpendGauge } from './SpendGauge';

// Zone 1 — the page's headline. A casual / mobile reader gets total + state +
// where-it-went here and can stop; everything denser is below the fold. Split
// into a pure `ExpenseOverviewView` (what the landing mock imports with fake
// data) and a thin `ExpenseOverviewCard` container that wires the live data.

export interface OverviewTopCategory {
  tag_id: number;
  tag_name: string;
  pctOfTotal: number; // 0–100, share of the month's total spend
}

export interface ExpenseOverviewViewProps {
  month: string; // YYYY-MM (formatted for display via formatYearMonth)
  total: BudgetCategory | null;
  deltaPct: number | null; // month-over-month, fraction (e.g. -0.04); null = unknown
  topCategories: OverviewTopCategory[];
  moreCount: number;
  onEditTotal?: (c: BudgetCategory) => void;
  onSeeCategories?: () => void;
}

export function ExpenseOverviewView({
  month,
  total,
  deltaPct,
  topCategories,
  moreCount,
  onEditTotal,
  onSeeCategories,
}: ExpenseOverviewViewProps) {
  return (
    <section
      data-testid="expense-overview"
      aria-labelledby="expense-overview-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="expense-overview-heading"
          className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
        >
          {formatYearMonth(month, 'long')}
        </h2>
        {total && <BudgetSignal category={total} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <TotalColumn
          total={total}
          deltaPct={deltaPct}
          onEditTotal={onEditTotal}
        />
        <CategoriesColumn
          topCategories={topCategories}
          moreCount={moreCount}
          onSeeCategories={onSeeCategories}
        />
      </div>
    </section>
  );
}

function TotalColumn({
  total,
  deltaPct,
  onEditTotal,
}: {
  total: BudgetCategory | null;
  deltaPct: number | null;
  onEditTotal?: (c: BudgetCategory) => void;
}) {
  const { money } = useMoneyFormatter();
  const current = total?.current_net_expense ?? 0;
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Total spent
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="money text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
          {money(current)}
        </span>
        <MonthDelta deltaPct={deltaPct} />
      </div>
      <div className="mt-4">
        <SpendGauge
          current={current}
          limit={total?.limit_amt ?? null}
          avg={total?.avg_net_expense ?? null}
          min={total?.min_net_expense ?? null}
          max={total?.max_net_expense ?? null}
        />
        <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          <GaugeCaption total={total} onEditTotal={onEditTotal} />
        </div>
      </div>
    </div>
  );
}

function GaugeCaption({
  total,
  onEditTotal,
}: {
  total: BudgetCategory | null;
  onEditTotal?: (c: BudgetCategory) => void;
}) {
  const { money } = useMoneyFormatter();
  const hasLimit = total?.limit_amt != null && total.limit_amt > 0;
  if (hasLimit) return <>of {money(total?.limit_amt)} limit</>;
  if (total && onEditTotal) {
    return (
      <button
        type="button"
        onClick={() => onEditTotal(total)}
        className="text-accent-600 dark:text-accent-300 font-medium hover:underline"
      >
        Set a budget
      </button>
    );
  }
  return <>vs your typical range</>;
}

function CategoriesColumn({
  topCategories,
  moreCount,
  onSeeCategories,
}: {
  topCategories: OverviewTopCategory[];
  moreCount: number;
  onSeeCategories?: () => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        Where it went
      </div>
      {topCategories.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No categorized spending yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {topCategories.map((c) => (
            <li key={c.tag_id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-slate-700 dark:text-slate-200">
                  {c.tag_name}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {Math.round(c.pctOfTotal)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="bg-accent-500 dark:bg-accent-400 h-full rounded-full"
                  style={{ width: `${Math.min(100, c.pctOfTotal)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {moreCount > 0 && onSeeCategories && (
        <button
          type="button"
          onClick={onSeeCategories}
          className="text-accent-600 dark:text-accent-300 mt-2 text-xs font-medium hover:underline"
        >
          +{moreCount} more →
        </button>
      )}
    </div>
  );
}

function MonthDelta({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return null;
  const up = deltaPct > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  // Spending more is the cautionary direction; reuse the semantic tokens.
  const tone = up
    ? 'text-danger-600 dark:text-danger-300'
    : 'text-success-600 dark:text-success-300';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {Math.abs(Math.round(deltaPct * 100))}% vs last month
    </span>
  );
}

// --- Live container -------------------------------------------------------

interface ExpenseOverviewCardProps {
  month: string; // YYYY-MM anchor (the page selector)
  total: BudgetCategory | null;
  categories: BudgetCategory[];
  onEditTotal: (c: BudgetCategory) => void;
  onSeeCategories: () => void;
}

export function ExpenseOverviewCard({
  month,
  total,
  categories,
  onEditTotal,
  onSeeCategories,
}: ExpenseOverviewCardProps) {
  const constants = useAuthStore((s) => s.constants);
  const totalTagId = constants?.TOTAL_TAG_ID;
  const miscTagId = constants?.MISCELLANEOUS_TAG_ID;

  // Month-over-month delta: the last two monthly Total buckets ending at the
  // anchor. Own small query (n=2) — distinct window from Zone 2's, react-query
  // caches it independently.
  const endDate = `${month}-01`;
  const trend = useExpenseTrendQuery(
    'monthly',
    2,
    totalTagId,
    totalTagId != null,
    endDate
  );
  const deltaPct = (() => {
    const rows = (trend.data?.rows ?? [])
      .filter((r) => r.tag_id === totalTagId)
      .slice(-2);
    if (rows.length < 2) return null;
    const prev = rows[0]!.net_expense;
    const cur = rows[1]!.net_expense;
    return prev > 0 ? (cur - prev) / prev : null;
  })();

  const totalSpend = total?.current_net_expense ?? 0;
  const ranked = categories
    .filter(
      (c) =>
        c.tag_id !== miscTagId &&
        c.tag_id !== totalTagId &&
        (c.current_net_expense ?? 0) > 0
    )
    .sort(
      (a, b) => (b.current_net_expense ?? 0) - (a.current_net_expense ?? 0)
    );
  const topCategories: OverviewTopCategory[] = ranked.slice(0, 3).map((c) => ({
    tag_id: c.tag_id,
    tag_name: c.tag_name,
    pctOfTotal:
      totalSpend > 0 ? ((c.current_net_expense ?? 0) / totalSpend) * 100 : 0,
  }));

  return (
    <ExpenseOverviewView
      month={month}
      total={total}
      deltaPct={deltaPct}
      topCategories={topCategories}
      moreCount={Math.max(0, ranked.length - topCategories.length)}
      onEditTotal={onEditTotal}
      onSeeCategories={onSeeCategories}
    />
  );
}
