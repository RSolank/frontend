import { useMemo, useState } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { useAuthStore } from '../../../shared/state/auth.store';
import { formatYearMonth } from '../../../shared/utils/dateUtils';
import { useExpenseTrendQuery } from '../../dashboard/api/queries';
import type { TrendPeriod } from '../../dashboard/api/schemas';

import {
  MiniBars,
  MiniDonut,
  MiniLine,
  OTHERS_SLICE,
  SLICE_PALETTE,
  type DonutSlice,
  type TrendPoint,
} from './trendCharts';

// Zone 2 — the analytical heart. Total trend (bars for short windows, line for
// longer) beside a category-breakdown donut, both for the selected window, with
// a stacked stats footer (this-window stats above rolling 12-month stats). The
// page's month anchor sets the window's end; the range presets set its span.

interface RangePreset {
  key: string;
  label: string;
  period: TrendPeriod;
  n: number | 'ytd';
}

const RANGES: RangePreset[] = [
  { key: '1w', label: '1W', period: 'weekly', n: 1 },
  { key: '1mo', label: '1M', period: 'weekly', n: 5 },
  { key: '3mo', label: '3M', period: 'weekly', n: 13 },
  { key: '6mo', label: '6M', period: 'monthly', n: 6 },
  { key: 'ytd', label: 'YTD', period: 'monthly', n: 'ytd' },
  { key: '1y', label: '1Y', period: 'monthly', n: 12 },
  { key: '2y', label: '2Y', period: 'monthly', n: 24 },
];
const BARS_MAX_POINTS = 5; // ≤ this → bars, else line
const MAX_SLICES = 6; // top 5 + "Others"

interface SpendTrendCardProps {
  month: string; // YYYY-MM page anchor
  rolling: { avg: number | null; min: number | null; max: number | null };
}

function bucketLabel(period_start: string, grain: TrendPeriod): string {
  if (grain === 'weekly') {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${period_start}T00:00:00Z`));
  }
  return formatYearMonth(period_start.slice(0, 7), 'short');
}

export function SpendTrendCard({ month, rolling }: SpendTrendCardProps) {
  const { money } = useMoneyFormatter();
  const constants = useAuthStore((s) => s.constants);
  const totalTagId = constants?.TOTAL_TAG_ID;
  const [rangeKey, setRangeKey] = useState('6mo');

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[3]!;
  const endDate = `${month}-01`;
  const n =
    range.n === 'ytd' ? Math.max(1, Number(month.split('-')[1] ?? 1)) : range.n;

  // Total-tag series (line/bars) + all-tag series (donut). Two queries, same
  // window; react-query caches each by (period, n, tag, end).
  const totalQ = useExpenseTrendQuery(
    range.period,
    n,
    totalTagId,
    totalTagId != null,
    endDate
  );
  const breakdownQ = useExpenseTrendQuery(
    range.period,
    n,
    undefined,
    totalTagId != null,
    endDate
  );

  const points: TrendPoint[] = useMemo(() => {
    const rows = (totalQ.data?.rows ?? [])
      .filter((r) => r.tag_id === totalTagId)
      .sort((a, b) => a.period_start.localeCompare(b.period_start));
    return rows.map((r) => ({
      label: bucketLabel(r.period_start, range.period),
      value: Math.max(0, r.net_expense),
    }));
  }, [totalQ.data, totalTagId, range.period]);

  const periodStats = useMemo(() => {
    const vals = points.map((p) => p.value);
    if (vals.length === 0) return null;
    return {
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }, [points]);

  const { slices, legend } = useMemo(
    () => buildBreakdown(breakdownQ.data?.rows ?? [], totalTagId),
    [breakdownQ.data, totalTagId]
  );

  const grainUnit = range.period === 'weekly' ? '/wk' : '/mo';
  const chartKind: 'bars' | 'line' =
    points.length <= BARS_MAX_POINTS ? 'bars' : 'line';

  return (
    <section
      data-testid="spend-trend"
      aria-labelledby="spend-trend-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="spend-trend-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Spending trend
        </h2>
        <RangeSelector rangeKey={rangeKey} onChange={setRangeKey} />
      </header>

      {totalQ.isLoading ? (
        <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Loading trend…
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <TrendChartArea
              points={points}
              chartKind={chartKind}
              avg={periodStats?.avg}
              money={money}
            />
          </div>
          <BreakdownArea slices={slices} legend={legend} money={money} />
        </div>
      )}

      {/* Stacked stats footer: this-window above rolling-12-month. */}
      <div className="mt-4 space-y-1.5 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
        <StatRow
          heading={`This ${range.label}`}
          avg={periodStats?.avg ?? null}
          min={periodStats?.min ?? null}
          max={periodStats?.max ?? null}
          unit={grainUnit}
          money={money}
        />
        <StatRow
          heading="Last 12 months"
          avg={rolling.avg}
          min={rolling.min}
          max={rolling.max}
          unit="/mo"
          money={money}
        />
      </div>
    </section>
  );
}

function RangeSelector({
  rangeKey,
  onChange,
}: {
  rangeKey: string;
  onChange: (k: string) => void;
}) {
  return (
    <div role="group" aria-label="Trend range" className="flex flex-wrap gap-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          aria-pressed={r.key === rangeKey}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            r.key === rangeKey
              ? 'bg-accent-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function TrendChartArea({
  points,
  chartKind,
  avg,
  money,
}: {
  points: TrendPoint[];
  chartKind: 'bars' | 'line';
  avg: number | undefined;
  money: (n: number | null | undefined) => string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        No spending in this window.
      </p>
    );
  }
  if (chartKind === 'bars') return <MiniBars data={points} money={money} />;
  return <MiniLine data={points} money={money} avg={avg} />;
}

function BreakdownArea({
  slices,
  legend,
  money,
}: {
  slices: DonutSlice[];
  legend: { label: string; pct: number; dotClass: string }[];
  money: (n: number | null | undefined) => string;
}) {
  if (slices.length === 0) {
    return (
      <div className="flex items-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No categorized spending.
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
            <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {Math.round(l.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatRow({
  heading,
  avg,
  min,
  max,
  unit,
  money,
}: {
  heading: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  unit: string;
  money: (n: number | null | undefined) => string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs">
      <span className="font-medium text-slate-500 dark:text-slate-400">
        {heading}
      </span>
      <span className="text-slate-600 dark:text-slate-300">
        avg{' '}
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {money(avg)}
          {unit}
        </span>
      </span>
      <span className="text-slate-600 dark:text-slate-300">
        low{' '}
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {money(min)}
        </span>
      </span>
      <span className="text-slate-600 dark:text-slate-300">
        high{' '}
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {money(max)}
        </span>
      </span>
    </div>
  );
}

// Aggregate all-tag rows into the donut: sum per tag over the window, drop the
// TOTAL roll-up, sort descending, cap at 6 slices (top 5 + "Others").
function buildBreakdown(
  rows: { tag_id: number; tag_name: string | null; net_expense: number }[],
  totalTagId: number | undefined
): { slices: DonutSlice[]; legend: { label: string; pct: number; dotClass: string }[] } {
  const byTag = new Map<number, { name: string; value: number }>();
  for (const r of rows) {
    if (r.tag_id === totalTagId) continue;
    const v = Math.max(0, r.net_expense);
    if (v <= 0) continue;
    const cur = byTag.get(r.tag_id);
    if (cur) cur.value += v;
    else byTag.set(r.tag_id, { name: r.tag_name ?? 'Untagged', value: v });
  }
  const ranked = [...byTag.values()].sort((a, b) => b.value - a.value);
  const grand = ranked.reduce((s, c) => s + c.value, 0);
  if (grand <= 0) return { slices: [], legend: [] };

  const head =
    ranked.length > MAX_SLICES ? ranked.slice(0, MAX_SLICES - 1) : ranked;
  const tail =
    ranked.length > MAX_SLICES ? ranked.slice(MAX_SLICES - 1) : [];
  const display = head.map((c, i) => ({
    name: c.name,
    value: c.value,
    palette: SLICE_PALETTE[i % SLICE_PALETTE.length]!,
  }));
  if (tail.length > 0) {
    display.push({
      name: 'Others',
      value: tail.reduce((s, c) => s + c.value, 0),
      palette: OTHERS_SLICE,
    });
  }
  const slices: DonutSlice[] = display.map((d) => ({
    label: d.name,
    value: d.value,
    pct: (d.value / grand) * 100,
    strokeClass: d.palette.strokeClass,
  }));
  const legend = display.map((d) => ({
    label: d.name,
    pct: (d.value / grand) * 100,
    dotClass: d.palette.dotClass,
  }));
  return { slices, legend };
}
