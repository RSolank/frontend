import { useMemo, useState } from 'react';

import {
  MiniBars,
  MiniDonut,
  MiniLine,
  type TrendPoint,
} from '../../../../shared/components/charts/trendCharts';
import { useMoneyFormatter } from '../../../../shared/hooks/useMoneyFormatter';
import {
  computeBudgetSignal,
  SIGNAL_STYLE,
} from '../../../../shared/lib/budgetSignal';
import { useAuthStore } from '../../../../shared/state/auth.store';
import {
  useBudgetStatusQuery,
  type BudgetCategory,
} from '../../../budgets/api/queries';
import { useExpenseTrendQuery } from '../../api/queries';

import { buildCategoryDonut, type DonutLegendRow } from './spendDonut';

const TREND_WEEKS = 13; // ~3 months, weekly grain
const BARS_MAX = 5;

function makeCompact(symbol: string | null): (n: number) => string {
  const fmt = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return (n: number) => `${symbol ?? ''}${fmt.format(n)}`;
}

function weekLabel(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return periodStart;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

// Zone ❸ (normal mode) — the analytical heart, reusing the ExpenseTracker
// chart language: a weekly spend trend (bars for short windows, line + average
// reference otherwise) beside a category breakdown donut, with BudgetSignal
// pills on the top categories. Composes the budgets read-model + the dashboard's
// expense-trend query through their public surfaces; deep-links to the Expense
// Tracker.
export function SpendAnalyticsCard() {
  const { money, currencySymbol } = useMoneyFormatter();
  const totalTagId = useAuthStore((s) => s.constants)?.TOTAL_TAG_ID;
  const compact = useMemo(() => makeCompact(currencySymbol), [currencySymbol]);

  const { data: budget } = useBudgetStatusQuery(null);
  const trendQ = useExpenseTrendQuery(
    'weekly',
    TREND_WEEKS,
    totalTagId,
    totalTagId != null
  );

  const points: TrendPoint[] = useMemo(() => {
    const rows = (trendQ.data?.rows ?? [])
      .filter((r) => r.tag_id === totalTagId)
      .sort((a, b) => a.period_start.localeCompare(b.period_start));
    return rows.map((r) => ({
      label: weekLabel(r.period_start),
      value: Math.max(0, r.net_expense),
    }));
  }, [trendQ.data, totalTagId]);

  const avg = useMemo(() => {
    if (points.length === 0) return undefined;
    return points.reduce((s, p) => s + p.value, 0) / points.length;
  }, [points]);

  const { slices, legend } = useMemo(
    () => buildCategoryDonut(budget?.categories ?? []),
    [budget]
  );
  const topCategories = useMemo(
    () =>
      (budget?.categories ?? [])
        .filter((c) => (c.current_net_expense ?? 0) > 0)
        .sort(
          (a, b) => (b.current_net_expense ?? 0) - (a.current_net_expense ?? 0)
        )
        .slice(0, 3),
    [budget]
  );

  return (
    <section
      data-testid="dashboard-analytics"
      aria-labelledby="dashboard-analytics-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h2
          id="dashboard-analytics-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Where your money went
        </h2>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <TrendArea points={points} avg={avg} money={money} compact={compact} />
        <DonutArea slices={slices} legend={legend} money={money} />
      </div>

      {topCategories.length > 0 ? (
        <SignalPills categories={topCategories} />
      ) : null}
    </section>
  );
}

function TrendArea({
  points,
  avg,
  money,
  compact,
}: {
  points: TrendPoint[];
  avg: number | undefined;
  money: (n: number | null | undefined) => string;
  compact: (n: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (points.length === 0) {
    return (
      <p
        className="flex items-center justify-center py-8 text-xs text-slate-500 dark:text-slate-400"
        data-testid="dashboard-analytics-trend-empty"
      >
        No spending in this window.
      </p>
    );
  }
  const active = hovered != null ? points[hovered] : null;
  const useBars = points.length <= BARS_MAX;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex h-5 items-baseline gap-2 text-xs">
        {active ? (
          <>
            <span className="font-medium text-slate-500 dark:text-slate-400">
              {active.label}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums dark:text-slate-100">
              {money(active.value)}
            </span>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">
            Weekly spend{avg != null ? ` · avg ${money(avg)}` : ''}
          </span>
        )}
      </div>
      {useBars ? (
        <MiniBars
          data={points}
          money={money}
          compact={compact}
          hovered={hovered}
          onHover={setHovered}
        />
      ) : (
        <MiniLine
          data={points}
          money={money}
          compact={compact}
          avg={avg}
          hovered={hovered}
          onHover={setHovered}
        />
      )}
    </div>
  );
}

function DonutArea({
  slices,
  legend,
  money,
}: {
  slices: ReturnType<typeof buildCategoryDonut>['slices'];
  legend: DonutLegendRow[];
  money: (n: number | null | undefined) => string;
}) {
  if (slices.length === 0) {
    return (
      <div className="flex items-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No categorized spending yet.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <MiniDonut slices={slices} money={money} />
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {legend.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${l.dotClass}`}
                aria-hidden="true"
              />
              <span className="truncate text-slate-600 dark:text-slate-300">
                {l.label}
              </span>
            </span>
            <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-slate-100">
              {Math.round(l.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// BudgetSignal pills for the top categories — the same classifier the Expense
// Tracker uses (shared/lib), so a category reads identically in both surfaces.
function SignalPills({ categories }: { categories: BudgetCategory[] }) {
  return (
    <div
      className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700"
      data-testid="dashboard-analytics-signals"
    >
      {categories.map((c) => {
        const state = computeBudgetSignal(c);
        const style = SIGNAL_STYLE[state.tone];
        return (
          <span
            key={c.tag_id}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.pill}`}
            data-testid={`dashboard-analytics-signal-${c.tag_id}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
              aria-hidden="true"
            />
            {c.tag_name} · {state.label}
          </span>
        );
      })}
    </div>
  );
}
