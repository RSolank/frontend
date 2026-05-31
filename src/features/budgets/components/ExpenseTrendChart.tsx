import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatYearMonth } from '../../../shared/utils/dateUtils';
import { useExpenseTrendQuery } from '../../dashboard/api/queries';
import type { ExpenseTrendRow } from '../../dashboard/api/schemas';

// BE Phase 1.7 (T-aggregates-engine, `3252ca4`) `GET /api/expense-tracker`.
// Compact 6-month bar chart of the Total tag's net_expense, rendered as
// inline SVG (no chart library — recharts is ~50 kB gz and would punch
// the bundle ceiling). Slots above the Categories grid on /budgets so the
// user gets a "last six months" frame for the active month rollup.
//
// Hover/focus a bar to surface its month + exact value via a tooltip; on
// touch viewports the tooltip surfaces on tap (focus-visible covers both).
const BUCKETS = 6;
const PERIOD_TYPE = 'monthly' as const;

// SVG paint constants — sized for a max-w-5xl page card. Width is set to
// the SVG's viewBox; CSS scales it to 100% of the container.
const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 140;
const BAR_GAP = 12;
const TOP_PADDING = 8;
const BOTTOM_PADDING = 28;

export function ExpenseTrendChart() {
  const constants = useAuthStore((s) => s.constants);
  const totalTagId = constants?.TOTAL_TAG_ID;
  const { money } = useMoneyFormatter();
  const timezone = usePreferencesStore((s) => s.timezone);

  const query = useExpenseTrendQuery(
    PERIOD_TYPE,
    BUCKETS,
    totalTagId,
    totalTagId != null
  );

  const rows = useMemo<ExpenseTrendRow[]>(() => {
    const all = query.data?.rows ?? [];
    // The endpoint may return rows for multiple tags when `tag_id` is
    // unset (it isn't here once constants land); defensively filter.
    if (totalTagId == null) return [];
    return all
      .filter((r) => r.tag_id === totalTagId)
      .slice(0, BUCKETS);
  }, [query.data, totalTagId]);

  if (totalTagId == null) return null;
  if (query.isLoading) {
    return (
      <TrendShell>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Loading trend…
        </p>
      </TrendShell>
    );
  }
  if (query.isError || rows.length === 0) {
    return (
      <TrendShell>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {query.isError
            ? "We couldn't load your spending trend."
            : 'Spend across at least one full month to see a trend.'}
        </p>
      </TrendShell>
    );
  }

  return (
    <TrendShell>
      <TrendSvg rows={rows} timezone={timezone} money={money} />
    </TrendShell>
  );
}

function TrendShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-testid="budgets-expense-trend"
      aria-labelledby="budgets-trend-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h2
          id="budgets-trend-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Spending trend
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Last 6 months
        </span>
      </header>
      {children}
    </section>
  );
}

interface TrendSvgProps {
  rows: ExpenseTrendRow[];
  timezone: string;
  money: (n: number | null | undefined) => string;
}

function TrendSvg({ rows, money }: TrendSvgProps) {
  const max = Math.max(...rows.map((r) => Math.max(0, r.net_expense)), 1);
  const innerHeight = VIEW_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const barWidth = (VIEW_WIDTH - BAR_GAP * (rows.length + 1)) / rows.length;

  return (
    <svg
      role="img"
      aria-label="Six-month spending trend"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-32 w-full"
    >
      {rows.map((r, i) => {
        const value = Math.max(0, r.net_expense);
        const barHeight = (value / max) * innerHeight;
        const x = BAR_GAP + i * (barWidth + BAR_GAP);
        const y = TOP_PADDING + (innerHeight - barHeight);
        const monthLabel = formatYearMonth(r.period_start.slice(0, 7), 'short');
        return (
          <g key={r.period_start} data-testid={`trend-bar-${i}`}>
            <title>{`${monthLabel}: ${money(value)}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              rx={3}
              ry={3}
              className="fill-indigo-500 dark:fill-indigo-400"
              tabIndex={0}
            />
            <text
              x={x + barWidth / 2}
              y={VIEW_HEIGHT - 12}
              textAnchor="middle"
              className="fill-slate-500 text-[11px] dark:fill-slate-400"
            >
              {monthLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
