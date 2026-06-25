import { m } from 'framer-motion';
import { useId } from 'react';

import { useDrawIn } from '../../motion';

// Hand-rolled inline-SVG trend primitives. Deliberately no chart library
// (recharts is ~50 kB gz and would punch the bundle ceiling). Pure /
// presentational — data + a `money` formatter come in via props, so the
// landing mock can render them with fabricated data. Hover is *controlled*
// (the chart-area owns the index + renders an HTML readout) so the value text
// never lives inside the non-uniformly-scaled SVG.
//
// Feature-agnostic shared primitives (relocated from features/budgets — they
// were never budget-specific). Consumed by the Expense Tracker (SpendTrendCard),
// the Savings page (SavingsTrend), and the landing showcases. Colour defaults to
// the brand `accent` palette; callers override per-instance via the *Class props.

type Money = (n: number | null | undefined) => string;
type Compact = (n: number) => string;

export interface TrendPoint {
  label: string;
  value: number;
}

interface HoverProps {
  hovered?: number | null;
  onHover?: (i: number | null) => void;
}

const W = 900;
const H = 240;
const TOP = 12;
// Small bottom inset now that the x-axis labels live in HTML below the SVG
// (they used to sit inside this band as `<text>`). Keeping it tiny lets the plot
// fill the height and sit just above the HTML label row.
const BOTTOM = 10;
const GUTTER = 72; // left space for the y-axis labels
const INNER = H - TOP - BOTTOM;
const PLOT_W = W - GUTTER;

// X-axis labels rendered as HTML beneath the chart, NOT as SVG `<text>`. The
// SVG uses `preserveAspectRatio="none"`, so anything inside it (including text)
// is scaled non-uniformly — in a narrow container the labels get horizontally
// crushed to the point of illegibility. Positioning them as absolutely-placed
// HTML spans (left% mapped from the same 0–W coordinate space the marks use)
// keeps them crisp at every width. Shared by MiniBars + MiniLine.
function XAxisLabels({
  ticks,
}: {
  ticks: { label: string; leftPct: number }[];
}) {
  return (
    <div className="relative mt-1 h-4 w-full">
      {ticks.map((t, i) => (
        <span
          key={`${t.label}-${i}`}
          className="absolute -translate-x-1/2 text-[11px] whitespace-nowrap text-slate-500 tabular-nums dark:text-slate-400"
          style={{ left: `${t.leftPct}%` }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

// Round a max up to a "nice" axis ceiling (1/2/5 × 10ⁿ) so gridline labels read
// cleanly (₹50k, not ₹47,312).
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  let nice = 10;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 5) nice = 5;
  return nice * pow;
}

// Three horizontal gridlines (0 / mid / max). Lines ONLY — horizontal lines
// survive the non-uniform scale fine, but the compact money labels render as
// HTML (see YAxisLabels) so they don't get crushed like the old SVG `<text>`.
function YAxisLines() {
  return (
    <g aria-hidden="true">
      {[0, 0.5, 1].map((f) => {
        const yy = TOP + INNER - f * INNER;
        return (
          <line
            key={f}
            x1={GUTTER}
            x2={W}
            y1={yy}
            y2={yy}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

// Compact money labels for the gridlines, as HTML in the left gutter (~8% =
// GUTTER/W), positioned at each gridline's vertical fraction. Absolutely placed
// inside the chart-area's relative box, so they stay crisp at any width.
function YAxisLabels({ max, compact }: { max: number; compact: Compact }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 w-[8%]"
    >
      {[0, 0.5, 1].map((f) => {
        const yy = TOP + INNER - f * INNER;
        return (
          <span
            key={f}
            className="absolute right-1 -translate-y-1/2 text-[11px] text-slate-400 tabular-nums dark:text-slate-500"
            style={{ top: `${(yy / H) * 100}%` }}
          >
            {compact(f * max)}
          </span>
        );
      })}
    </div>
  );
}

// Vertical bars — used for short windows (≤5 buckets) where a line would look
// broken. Hovering/tapping a bar emphasises it (others dim) + drives the
// chart-area readout.
export function MiniBars({
  data,
  money,
  compact,
  hovered = null,
  onHover,
  barClass = 'fill-accent-500 dark:fill-accent-400',
  heightClass = 'h-52 w-full sm:h-56',
}: {
  data: TrendPoint[];
  money: Money;
  compact: Compact;
  barClass?: string;
  // Override the SVG height — heroes render a compact spark (e.g. 'h-24 w-full').
  heightClass?: string;
} & HoverProps) {
  const max = niceCeil(Math.max(...data.map((d) => Math.max(0, d.value)), 1));
  const gap = 16;
  const barWidth = (PLOT_W - gap * (data.length + 1)) / data.length;
  const barX = (i: number) => GUTTER + gap + i * (barWidth + gap);
  const draw = useDrawIn();
  const ticks = data.map((d, i) => ({
    label: d.label,
    leftPct: ((barX(i) + barWidth / 2) / W) * 100,
  }));
  return (
    <div className="w-full">
      <div className="relative">
        <svg
          role="img"
          aria-label="Spending by period"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={heightClass}
          onMouseLeave={() => onHover?.(null)}
        >
          <YAxisLines />
          {data.map((d, i) => {
            const value = Math.max(0, d.value);
            const barHeight = Math.max((value / max) * INNER, 2);
            const x = barX(i);
            const y = TOP + (INNER - barHeight);
            const dim = hovered != null && hovered !== i;
            return (
              <g
                key={`${d.label}-${i}`}
                className="cursor-pointer"
                onMouseEnter={() => onHover?.(i)}
                onClick={() => onHover?.(hovered === i ? null : i)}
              >
                <title>{`${d.label}: ${money(value)}`}</title>
                <m.rect
                  x={x}
                  width={barWidth}
                  // Resting geometry as direct attrs so the first paint (before
                  // framer hydrates the variant) is already correct — no flash of
                  // a wrong state when static (page hasn't adopted motion).
                  height={barHeight}
                  y={y}
                  rx={3}
                  className={`${barClass} transition-opacity ${dim ? 'opacity-40' : ''}`}
                  initial={draw.initial}
                  animate={draw.animate}
                  variants={{
                    hidden: { height: 0, y: TOP + INNER },
                    show: {
                      height: barHeight,
                      y,
                      transition: {
                        duration: 0.5,
                        ease: 'easeOut',
                        delay: i * 0.05,
                      },
                    },
                  }}
                />
              </g>
            );
          })}
        </svg>
        <YAxisLabels max={max} compact={compact} />
      </div>
      <XAxisLabels ticks={ticks} />
    </div>
  );
}

// Line + soft area + a dashed average reference. Used for windows with enough
// points (>5) to read as a trend. Transparent hit-bands make the (small) points
// easy to hover/tap; the active point enlarges + a guide line drops to the axis.
// Colour defaults to `accent`; pass lineClass/areaClass/dotClass to re-theme
// (e.g. the Savings trend renders emerald).
export function MiniLine({
  data,
  money,
  compact,
  avg,
  hovered = null,
  onHover,
  lineClass = 'stroke-accent-500 dark:stroke-accent-400',
  areaClass = 'fill-accent-500/10 dark:fill-accent-400/10',
  dotClass = 'fill-accent-600 dark:fill-accent-300',
  heightClass = 'h-52 w-full sm:h-56',
}: {
  data: TrendPoint[];
  money: Money;
  compact: Compact;
  avg?: number | null;
  lineClass?: string;
  areaClass?: string;
  dotClass?: string;
  // Override the SVG height — heroes render a compact spark (e.g. 'h-24 w-full').
  heightClass?: string;
} & HoverProps) {
  const max = niceCeil(Math.max(...data.map((d) => d.value), 1));
  const padX = 10;
  const n = data.length;
  const x = (i: number) =>
    GUTTER + padX + (i * (PLOT_W - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) => TOP + (INNER - (Math.max(0, v) / max) * INNER);
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${x(0)},${TOP + INNER} ${line} ${x(n - 1)},${TOP + INNER}`;
  // Label ~6 evenly-spaced ticks so a 24-point line doesn't crowd the axis.
  const step = Math.max(1, Math.ceil(n / 6));
  const bandW = (PLOT_W - padX) / Math.max(1, n);
  const draw = useDrawIn();
  const clipId = useId().replace(/:/g, '');
  const ticks = data.flatMap((d, i) =>
    i % step === 0 ? [{ label: d.label, leftPct: (x(i) / W) * 100 }] : []
  );
  return (
    <div className="w-full">
      <div className="relative">
        <svg
          role="img"
          aria-label="Spending trend"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={heightClass}
          onMouseLeave={() => onHover?.(null)}
        >
          <YAxisLines />
          {/* The area is a static polygon revealed by an animated clip rect that
              grows left-to-right in step with the line draw — so the fill widens
              horizontally as the line advances, not fading in as a whole block. */}
          <clipPath id={clipId}>
            <m.rect
              x={0}
              y={0}
              height={H}
              width={W}
              initial={draw.initial}
              animate={draw.animate}
              variants={{
                hidden: { width: 0 },
                show: {
                  width: W,
                  transition: { duration: 0.8, ease: 'easeOut' },
                },
              }}
            />
          </clipPath>
          <polygon
            points={area}
            className={areaClass}
            clipPath={`url(#${clipId})`}
          />
          {avg != null && avg > 0 && avg <= max && (
            <line
              x1={GUTTER + padX}
              x2={W - padX}
              y1={y(avg)}
              y2={y(avg)}
              strokeDasharray="4 4"
              className="stroke-slate-400/70 dark:stroke-slate-500"
              strokeWidth={1}
            />
          )}
          <m.polyline
            points={line}
            fill="none"
            className={lineClass}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={draw.initial}
            animate={draw.animate}
            variants={{
              hidden: { pathLength: 0 },
              show: {
                pathLength: 1,
                transition: { duration: 0.8, ease: 'easeOut' },
              },
            }}
          />
          {hovered != null && data[hovered] && (
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={TOP}
              y2={TOP + INNER}
              className="stroke-slate-300 dark:stroke-slate-600"
              strokeWidth={1}
            />
          )}
          {data.map((d, i) => (
            <g key={`pt-${d.label}-${i}`}>
              <m.circle
                cx={x(i)}
                cy={y(d.value)}
                r={hovered === i ? 5 : 3}
                className={dotClass}
                initial={draw.initial}
                animate={draw.animate}
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { duration: 0.4, delay: 0.3 },
                  },
                }}
              />
            </g>
          ))}
          {data.map((d, i) => (
            <rect
              key={`hit-${i}`}
              x={x(i) - bandW / 2}
              y={TOP}
              width={bandW}
              height={INNER}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => onHover?.(i)}
              onClick={() => onHover?.(hovered === i ? null : i)}
            >
              <title>{`${d.label}: ${money(d.value)}`}</title>
            </rect>
          ))}
        </svg>
        <YAxisLabels max={max} compact={compact} />
      </div>
      <XAxisLabels ticks={ticks} />
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  pct: number; // 0–100
  strokeClass: string; // text-<color>-500 (stroke=currentColor)
}

// Category breakdown donut (stroke-dasharray arcs). Always meaningful, even for
// short windows where the line/bars are sparse.
export function MiniDonut({
  slices,
  money,
}: {
  slices: DonutSlice[];
  money: Money;
}) {
  const size = 168;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const draw = useDrawIn();
  // Seconds for the whole ring to fill. Every arc animates over the SAME
  // window with NO delay, so they grow simultaneously and in lockstep: each
  // arc's start (strokeDashoffset) and length (strokeDasharray) both scale
  // with the shared progress, so an arc's start rides the growing end of the
  // one before it — the ring fills seamlessly as one body rather than a
  // relay of fixed-position arcs.
  const DONUT_DRAW = 0.9;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Spending by category"
      className="h-40 w-40 shrink-0"
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {slices.map((s) => {
          const len = (s.pct / 100) * c;
          const offset = acc;
          acc += len;
          // Resting arc as direct attrs — the correct first paint when static
          // (plain <circle>, no framer) and the resting target when animated.
          const common = {
            cx: size / 2,
            cy: size / 2,
            r,
            fill: 'none',
            stroke: 'currentColor',
            className: s.strokeClass,
            strokeWidth: stroke,
            strokeDasharray: `${len} ${c - len}`,
            strokeDashoffset: -offset,
          };
          const title = (
            <title>{`${s.label}: ${money(s.value)} (${Math.round(s.pct)}%)`}</title>
          );
          // Static page → plain SVG so framer never animates it (no relay flash
          // when lazy features arrive late on a cold load).
          if (!draw.animated) {
            return (
              <circle key={s.label} {...common}>
                {title}
              </circle>
            );
          }
          return (
            <m.circle
              key={s.label}
              {...common}
              initial={draw.initial}
              animate={draw.animate}
              variants={{
                hidden: { strokeDasharray: `0 ${c}`, strokeDashoffset: 0 },
                show: {
                  // Offset AND length both grow with the same progress, no
                  // delay — every arc's start is pushed along by the one before
                  // it as they all fill together.
                  strokeDasharray: `${len} ${c - len}`,
                  strokeDashoffset: -offset,
                  transition: { duration: DONUT_DRAW, ease: 'easeOut' },
                },
              }}
            >
              {title}
            </m.circle>
          );
        })}
      </g>
    </svg>
  );
}

// Categorical palette for donut slices (reuses standard Tailwind hues — the
// same family the old landing mock used). "Others" is the muted slate tail.
export const SLICE_PALETTE: { strokeClass: string; dotClass: string }[] = [
  { strokeClass: 'text-teal-500', dotClass: 'bg-teal-500' },
  { strokeClass: 'text-blue-500', dotClass: 'bg-blue-500' },
  { strokeClass: 'text-purple-500', dotClass: 'bg-purple-500' },
  { strokeClass: 'text-amber-500', dotClass: 'bg-amber-500' },
  { strokeClass: 'text-rose-500', dotClass: 'bg-rose-500' },
];
export const OTHERS_SLICE = {
  strokeClass: 'text-slate-400',
  dotClass: 'bg-slate-400',
};
