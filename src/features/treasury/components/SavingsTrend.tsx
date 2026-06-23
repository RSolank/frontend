import { useMemo, useState } from 'react';

import {
  MiniBars,
  MiniLine,
  type TrendPoint,
} from '../../../shared/components/charts/trendCharts';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import type { TreasuryTrendPoint } from '../api/queries';

// Compact money for the chart's y-axis labels (₹50k, ₹1.2M) — runtime locale
// drives the abbreviation; full values stay in the hover readout. (Mirrors the
// Expense Tracker's makeCompact; kept local rather than exported to avoid a
// cross-feature import.)
function makeCompact(symbol: string | null): (n: number) => string {
  const fmt = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return (n: number) => `${symbol ?? ''}${fmt.format(n)}`;
}

// Short "23 Jun" axis label for an ISO week-end (YYYY-MM-DD). Formatted at UTC
// — a week-end label has no timezone of its own.
function weekLabel(periodEnd: string): string {
  const d = new Date(`${periodEnd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return periodEnd;
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

// Zone 3 — the cumulative set-aside trend (running funded balance per ISO
// week, oldest → newest). Bars for short windows (≤5 buckets, where a line
// reads as broken), a line otherwise. Themed emerald to match the Savings
// palette. Controlled hover renders the value as an HTML readout above the
// chart (the SVG is scaled non-uniformly, so in-chart value text distorts).
export function SavingsTrend({ trend }: { trend: TreasuryTrendPoint[] }) {
  const { money, currencySymbol } = useMoneyFormatter();
  const compact = useMemo(() => makeCompact(currencySymbol), [currencySymbol]);
  const [hovered, setHovered] = useState<number | null>(null);

  const points: TrendPoint[] = useMemo(
    () =>
      trend.map((p) => ({
        label: weekLabel(p.period_end),
        value: p.cumulative_balance,
      })),
    [trend]
  );

  const active = hovered != null ? points[hovered] : null;
  const useBars = points.length <= 5;

  return (
    <section
      aria-labelledby="savings-trend-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-1 flex items-baseline justify-between">
        <h2
          id="savings-trend-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Set aside over time
        </h2>
        {/* HTML readout — shows the hovered week's running balance, else a hint. */}
        <span
          className="text-sm text-slate-500 dark:text-slate-400"
          data-testid="savings-trend-readout"
        >
          {active ? (
            <>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {money(active.value)}
              </span>{' '}
              · {active.label}
            </>
          ) : (
            'Running balance, by week'
          )}
        </span>
      </header>

      {useBars ? (
        <MiniBars
          data={points}
          money={money}
          compact={compact}
          hovered={hovered}
          onHover={setHovered}
          barClass="fill-emerald-500 dark:fill-emerald-400"
        />
      ) : (
        <MiniLine
          data={points}
          money={money}
          compact={compact}
          hovered={hovered}
          onHover={setHovered}
          lineClass="stroke-emerald-500 dark:stroke-emerald-400"
          areaClass="fill-emerald-500/10 dark:fill-emerald-400/10"
          dotClass="fill-emerald-600 dark:fill-emerald-300"
        />
      )}
    </section>
  );
}
