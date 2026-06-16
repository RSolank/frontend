import { useMemo, useState, type ReactNode } from 'react';

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
  label: string; // short, for the selector buttons (1W / 3M / …)
  longLabel: string; // expanded, for the footer scope row (Last 3 months / …)
  period: TrendPeriod;
  n: number | 'ytd';
}

const RANGES: RangePreset[] = [
  { key: '1w', label: '1W', longLabel: 'Last week', period: 'weekly', n: 1 },
  { key: '1mo', label: '1M', longLabel: 'Last month', period: 'weekly', n: 5 },
  { key: '3mo', label: '3M', longLabel: 'Last 3 months', period: 'weekly', n: 13 },
  { key: '6mo', label: '6M', longLabel: 'Last 6 months', period: 'monthly', n: 6 },
  { key: 'ytd', label: 'YTD', longLabel: 'Year to date', period: 'monthly', n: 'ytd' },
  { key: '1y', label: '1Y', longLabel: 'Last year', period: 'monthly', n: 12 },
  { key: '2y', label: '2Y', longLabel: 'Last 2 years', period: 'monthly', n: 24 },
];
const BARS_MAX_POINTS = 5; // ≤ this → bars, else line
const MAX_SLICES = 6; // top 5 + "Others"

interface SpendTrendCardProps {
  month: string; // YYYY-MM page anchor
  // Top-level tag ids — the donut breakdown ranks roots only so a parent and
  // its child aren't double-counted.
  rootTagIds?: Set<number>;
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

export function SpendTrendCard({ month, rootTagIds }: SpendTrendCardProps) {
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

  // Rolling baseline = the latest displayed bucket's STORED stats, which the BE
  // computes per grain. So a weekly view reads its 52-week rolling and a monthly
  // view its 12-month rolling — grain-correct, already in the trend response.
  const rolling = useMemo(() => {
    const rows = (totalQ.data?.rows ?? [])
      .filter((r) => r.tag_id === totalTagId)
      .sort((a, b) => a.period_start.localeCompare(b.period_start));
    const last = rows[rows.length - 1];
    return {
      avg: last?.avg_net_expense ?? null,
      min: last?.min_net_expense ?? null,
      max: last?.max_net_expense ?? null,
    };
  }, [totalQ.data, totalTagId]);

  const { slices, legend } = useMemo(
    () => buildBreakdown(breakdownQ.data?.rows ?? [], totalTagId, rootTagIds),
    [breakdownQ.data, totalTagId, rootTagIds]
  );

  const grainUnit = range.period === 'weekly' ? '/wk' : '/mo';
  const chartKind: 'bars' | 'line' =
    points.length <= BARS_MAX_POINTS ? 'bars' : 'line';

  return (
    <SpendTrendView
      rangeKey={rangeKey}
      onRangeChange={setRangeKey}
      loading={totalQ.isLoading}
      points={points}
      chartKind={chartKind}
      periodStats={periodStats}
      grain={range.period}
      grainUnit={grainUnit}
      rangeLabel={range.longLabel}
      rolling={rolling}
      slices={slices}
      legend={legend}
    />
  );
}

interface SpendTrendViewProps {
  rangeKey: string;
  onRangeChange?: (k: string) => void;
  loading?: boolean;
  points: TrendPoint[];
  chartKind: 'bars' | 'line';
  periodStats: { avg: number; min: number; max: number } | null;
  grain: TrendPeriod;
  grainUnit: string;
  rangeLabel: string;
  rolling: { avg: number | null; min: number | null; max: number | null };
  slices: DonutSlice[];
  legend: { label: string; pct: number; dotClass: string }[];
}

// Compact money for the chart's y-axis labels (₹50k, ₹1.2M) — the runtime
// locale drives the abbreviation. Full values stay in the hover readout + footer.
function makeCompact(symbol: string | null): (n: number) => string {
  const fmt = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return (n: number) => `${symbol ?? ''}${fmt.format(n)}`;
}

// Pure render — the landing-page showcase imports this with fabricated data
// (omit `onRangeChange` for a static, non-interactive range row).
export function SpendTrendView({
  rangeKey,
  onRangeChange,
  loading = false,
  points,
  chartKind,
  periodStats,
  grain,
  grainUnit,
  rangeLabel,
  rolling,
  slices,
  legend,
}: SpendTrendViewProps) {
  const { money, currencySymbol } = useMoneyFormatter();
  const compact = useMemo(() => makeCompact(currencySymbol), [currencySymbol]);
  const rollingLabel = grain === 'weekly' ? 'Last 52 weeks' : 'Last 12 months';
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
        <RangeSelector rangeKey={rangeKey} onChange={onRangeChange} />
      </header>

      {loading ? (
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
              compact={compact}
            />
          </div>
          <BreakdownArea slices={slices} legend={legend} money={money} />
        </div>
      )}

      {/* Tabular footer: aligned avg/low/high columns. Row 1 = the selected
          window; row 2 = the grain-matched rolling baseline (52 wk / 12 mo). */}
      <div className="mt-4 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
        <div className="grid grid-cols-[minmax(5rem,auto)_1fr_1fr_1fr] gap-x-3 gap-y-1 text-xs">
          <span aria-hidden="true" />
          <StatHead>avg</StatHead>
          <StatHead>low</StatHead>
          <StatHead>high</StatHead>
          <StatCells
            heading={rangeLabel}
            avg={periodStats?.avg ?? null}
            min={periodStats?.min ?? null}
            max={periodStats?.max ?? null}
            unit={grainUnit}
            money={money}
          />
          <StatCells
            heading={rollingLabel}
            avg={rolling.avg}
            min={rolling.min}
            max={rolling.max}
            unit={grainUnit}
            money={money}
          />
        </div>
      </div>
    </section>
  );
}

function RangeSelector({
  rangeKey,
  onChange,
}: {
  rangeKey: string;
  onChange?: (k: string) => void;
}) {
  return (
    <div role="group" aria-label="Trend range" className="flex flex-wrap gap-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={onChange ? () => onChange(r.key) : undefined}
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
  compact,
}: {
  points: TrendPoint[];
  chartKind: 'bars' | 'line';
  avg: number | undefined;
  money: (n: number | null | undefined) => string;
  compact: (n: number) => string;
}) {
  // Hover is owned here so the value readout is plain HTML (the SVG is scaled
  // non-uniformly, which would distort in-chart text).
  const [hovered, setHovered] = useState<number | null>(null);
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        No spending in this window.
      </p>
    );
  }
  const active = hovered != null ? points[hovered] : null;
  return (
    <div>
      <div className="mb-1 flex h-5 items-baseline gap-2 text-xs">
        {active ? (
          <>
            <span className="font-medium text-slate-500 dark:text-slate-400">
              {active.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {money(active.value)}
            </span>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">
            Hover or tap a {chartKind === 'bars' ? 'bar' : 'point'} for detail
          </span>
        )}
      </div>
      {chartKind === 'bars' ? (
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
            <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-slate-100">
              {Math.round(l.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Column header for the stats table (avg / low / high), right-aligned over the
// numeric cells.
function StatHead({ children }: { children: ReactNode }) {
  return (
    <span className="text-right text-[11px] font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
      {children}
    </span>
  );
}

// One stats row rendered as bare grid cells (a Fragment, so the 4 cells flow
// into the parent grid and stay column-aligned across rows).
function StatCells({
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
    <>
      <span className="font-medium text-slate-500 dark:text-slate-400">
        {heading}
      </span>
      <span className="text-right font-semibold text-slate-900 tabular-nums dark:text-slate-100">
        {money(avg)}
        <span className="font-normal text-slate-400 dark:text-slate-500">
          {unit}
        </span>
      </span>
      <span className="text-right font-semibold text-slate-900 tabular-nums dark:text-slate-100">
        {money(min)}
      </span>
      <span className="text-right font-semibold text-slate-900 tabular-nums dark:text-slate-100">
        {money(max)}
      </span>
    </>
  );
}

// Sum the window's positive spend per tag, dropping the TOTAL roll-up and
// (when the tag tree is loaded) any non-root tag so a parent + child aren't
// both counted. Miscellaneous IS kept — it's a real (uncategorized) share of
// total spend and the denominator below is the full total. Returns the tags
// ranked descending by value.
function rankTagSpend(
  rows: { tag_id: number; tag_name: string | null; net_expense: number }[],
  totalTagId: number | undefined,
  rootTagIds?: Set<number>
): { name: string; value: number }[] {
  const rootsReady = rootTagIds != null && rootTagIds.size > 0;
  const byTag = new Map<number, { name: string; value: number }>();
  for (const r of rows) {
    const skip =
      r.tag_id === totalTagId || (rootsReady && !rootTagIds!.has(r.tag_id));
    const v = Math.max(0, r.net_expense);
    if (skip || v <= 0) continue;
    const cur = byTag.get(r.tag_id);
    if (cur) cur.value += v;
    else byTag.set(r.tag_id, { name: r.tag_name ?? 'Untagged', value: v });
  }
  return [...byTag.values()].sort((a, b) => b.value - a.value);
}

// Aggregate all-tag rows into the donut: sum per root category over the window
// (TOTAL roll-up excluded; Miscellaneous kept), sort descending, cap at 6 slices
// (top 5 + "Others"). Percentages are of **total** spend (root sum = total), the
// same denominator Zone 1's top categories use, so a category reads the same %
// in both zones.
function buildBreakdown(
  rows: { tag_id: number; tag_name: string | null; net_expense: number }[],
  totalTagId: number | undefined,
  rootTagIds?: Set<number>
): {
  slices: DonutSlice[];
  legend: { label: string; pct: number; dotClass: string }[];
} {
  const ranked = rankTagSpend(rows, totalTagId, rootTagIds);
  const grand = ranked.reduce((s, c) => s + c.value, 0);
  if (grand <= 0) return { slices: [], legend: [] };

  const head =
    ranked.length > MAX_SLICES ? ranked.slice(0, MAX_SLICES - 1) : ranked;
  const tail = ranked.length > MAX_SLICES ? ranked.slice(MAX_SLICES - 1) : [];
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
