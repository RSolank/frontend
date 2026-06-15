import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { computeBudgetSignal, SIGNAL_STYLE } from '../lib/budgetSignal';

// The unified spend bar. Two modes, one clean visual:
//   • limit set → fill vs the limit; a threshold line marks the limit, an `avg`
//     tick marks the typical month, and (only when breached) a `max` tick shows
//     whether this is the most expensive month yet.
//   • no limit → fill vs the rolling `max`; the `avg` tick marks the typical
//     month so a budget-less category still reads high/low at a glance.
// `min` rides in the tooltip rather than as a third tick, to keep it clean.
interface SpendGaugeProps {
  current: number;
  limit: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

type Money = (n: number | null | undefined) => string;

function clampPct(value: number, scaleMax: number): number {
  if (scaleMax <= 0) return 0;
  return Math.min(100, Math.max(0, (value / scaleMax) * 100));
}

// Scale end: 0 → limit normally; extend past the limit when breached so the
// overshoot (and the max tick) stay visible. No limit → 0 → rolling max.
function scaleEnd(
  hasLimit: boolean,
  breached: boolean,
  current: number,
  limit: number | null,
  mx: number
): number {
  if (!hasLimit) return Math.max(current, mx, 1);
  if (breached) return Math.max(current, mx) * 1.05;
  return limit as number;
}

interface GaugeTick {
  at: number;
  className: string;
}

function buildTicks(
  scaleMax: number,
  opts: {
    hasLimit: boolean;
    breached: boolean;
    limit: number | null;
    avg: number;
    max: number;
  }
): GaugeTick[] {
  const ticks: GaugeTick[] = [];
  if (opts.avg > 0 && opts.avg <= scaleMax) {
    ticks.push({
      at: clampPct(opts.avg, scaleMax),
      className: 'bg-slate-500 dark:bg-slate-300',
    });
  }
  if (opts.hasLimit) {
    ticks.push({
      at: clampPct(opts.limit as number, scaleMax),
      className: 'bg-slate-700 dark:bg-slate-100',
    });
  }
  if (opts.breached && opts.max > 0 && opts.max <= scaleMax) {
    ticks.push({
      at: clampPct(opts.max, scaleMax),
      className: 'bg-danger-500 dark:bg-danger-400',
    });
  }
  return ticks;
}

function gaugeTitle(
  money: Money,
  v: {
    current: number;
    hasLimit: boolean;
    limit: number | null;
    avg: number;
    min: number;
    max: number;
  }
): string {
  return [
    `Spent ${money(v.current)}`,
    v.hasLimit ? `limit ${money(v.limit)}` : null,
    v.avg > 0 ? `typical ${money(v.avg)}` : null,
    v.min > 0 ? `low ${money(v.min)}` : null,
    v.max > 0 ? `high ${money(v.max)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function SpendGauge({ current, limit, avg, min, max }: SpendGaugeProps) {
  const { money } = useMoneyFormatter();
  const hasLimit = limit != null && limit > 0;
  const breached = hasLimit && current > (limit as number);
  const a = avg ?? 0;
  const mx = max ?? 0;
  const scaleMax = scaleEnd(hasLimit, breached, current, limit, mx);
  const fillTone = computeBudgetSignal({
    current_net_expense: current,
    avg_net_expense: avg,
    max_net_expense: max,
    limit_amt: limit,
  }).tone;
  const ticks = buildTicks(scaleMax, { hasLimit, breached, limit, avg: a, max: mx });
  const title = gaugeTitle(money, {
    current,
    hasLimit,
    limit,
    avg: a,
    min: min ?? 0,
    max: mx,
  });

  return (
    <div
      className="relative h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800"
      title={title}
      role="img"
      aria-label={title}
    >
      <div
        className={`h-full rounded-full ${SIGNAL_STYLE[fillTone].bar}`}
        style={{ width: `${clampPct(current, scaleMax)}%` }}
      />
      {ticks.map((t, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`absolute top-[-2px] h-[calc(100%+4px)] w-0.5 -translate-x-1/2 rounded-full ${t.className}`}
          style={{ left: `${t.at}%` }}
        />
      ))}
    </div>
  );
}
