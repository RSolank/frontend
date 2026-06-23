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
const BOTTOM = 34;
const GUTTER = 72; // left space for the y-axis labels
const INNER = H - TOP - BOTTOM;
const PLOT_W = W - GUTTER;

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

// Three horizontal gridlines (0 / mid / max) with compact money labels in the
// left gutter. aria-hidden — the values are announced via the HTML readout.
function YAxis({ max, compact }: { max: number; compact: Compact }) {
  return (
    <g aria-hidden="true">
      {[0, 0.5, 1].map((f) => {
        const t = f * max;
        const yy = TOP + INNER - f * INNER;
        return (
          <g key={f}>
            <line
              x1={GUTTER}
              x2={W}
              y1={yy}
              y2={yy}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth={1}
            />
            <text
              x={GUTTER - 8}
              y={yy + 4}
              textAnchor="end"
              className="fill-slate-400 text-[11px] dark:fill-slate-500"
            >
              {compact(t)}
            </text>
          </g>
        );
      })}
    </g>
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
}: {
  data: TrendPoint[];
  money: Money;
  compact: Compact;
  barClass?: string;
} & HoverProps) {
  const max = niceCeil(Math.max(...data.map((d) => Math.max(0, d.value)), 1));
  const gap = 16;
  const barWidth = (PLOT_W - gap * (data.length + 1)) / data.length;
  const barX = (i: number) => GUTTER + gap + i * (barWidth + gap);
  return (
    <svg
      role="img"
      aria-label="Spending by period"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-52 w-full sm:h-56"
      onMouseLeave={() => onHover?.(null)}
    >
      <YAxis max={max} compact={compact} />
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
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={3}
              className={`${barClass} transition-opacity ${dim ? 'opacity-40' : ''}`}
            />
            <text
              x={x + barWidth / 2}
              y={H - 12}
              textAnchor="middle"
              className="fill-slate-500 text-[12px] dark:fill-slate-400"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
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
}: {
  data: TrendPoint[];
  money: Money;
  compact: Compact;
  avg?: number | null;
  lineClass?: string;
  areaClass?: string;
  dotClass?: string;
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
  return (
    <svg
      role="img"
      aria-label="Spending trend"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-52 w-full sm:h-56"
      onMouseLeave={() => onHover?.(null)}
    >
      <YAxis max={max} compact={compact} />
      <polygon points={area} className={areaClass} />
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
      <polyline
        points={line}
        fill="none"
        className={lineClass}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
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
          <circle
            cx={x(i)}
            cy={y(d.value)}
            r={hovered === i ? 5 : 3}
            className={dotClass}
          />
          {i % step === 0 && (
            <text
              x={x(i)}
              y={H - 12}
              textAnchor="middle"
              className="fill-slate-500 text-[12px] dark:fill-slate-400"
            >
              {d.label}
            </text>
          )}
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
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              className={s.strokeClass}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
            >
              <title>{`${s.label}: ${money(s.value)} (${Math.round(s.pct)}%)`}</title>
            </circle>
          );
          acc += len;
          return el;
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
export const OTHERS_SLICE = { strokeClass: 'text-slate-400', dotClass: 'bg-slate-400' };
