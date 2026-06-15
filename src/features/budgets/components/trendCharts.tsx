// Hand-rolled inline-SVG trend primitives. Deliberately no chart library
// (recharts is ~50 kB gz and would punch the bundle ceiling). Pure /
// presentational — data + a `money` formatter come in via props, so the
// landing mock can render them with fabricated data.

type Money = (n: number | null | undefined) => string;

export interface TrendPoint {
  label: string;
  value: number;
}

const W = 900;
const H = 240;
const TOP = 12;
const BOTTOM = 34;
const INNER = H - TOP - BOTTOM;

// Vertical bars — used for short windows (≤5 buckets) where a line would look
// broken.
export function MiniBars({
  data,
  money,
  barClass = 'fill-accent-500 dark:fill-accent-400',
}: {
  data: TrendPoint[];
  money: Money;
  barClass?: string;
}) {
  const max = Math.max(...data.map((d) => Math.max(0, d.value)), 1);
  const gap = 16;
  const barWidth = (W - gap * (data.length + 1)) / data.length;
  return (
    <svg
      role="img"
      aria-label="Spending by period"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-52 w-full sm:h-56"
    >
      {data.map((d, i) => {
        const value = Math.max(0, d.value);
        const barHeight = Math.max((value / max) * INNER, 2);
        const x = gap + i * (barWidth + gap);
        const y = TOP + (INNER - barHeight);
        return (
          <g key={`${d.label}-${i}`}>
            <title>{`${d.label}: ${money(value)}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={3}
              className={barClass}
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
// points (>5) to read as a trend.
export function MiniLine({
  data,
  money,
  avg,
}: {
  data: TrendPoint[];
  money: Money;
  avg?: number | null;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const padX = 10;
  const n = data.length;
  const x = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) => TOP + (INNER - (Math.max(0, v) / max) * INNER);
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${x(0)},${TOP + INNER} ${line} ${x(n - 1)},${TOP + INNER}`;
  // Label ~6 evenly-spaced ticks so a 24-point line doesn't crowd the axis.
  const step = Math.max(1, Math.ceil(n / 6));
  return (
    <svg
      role="img"
      aria-label="Spending trend"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-52 w-full sm:h-56"
    >
      <polygon
        points={area}
        className="fill-accent-500/10 dark:fill-accent-400/10"
      />
      {avg != null && avg > 0 && avg <= max && (
        <line
          x1={padX}
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
        className="stroke-accent-500 dark:stroke-accent-400"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <g key={`${d.label}-${i}`}>
          <title>{`${d.label}: ${money(d.value)}`}</title>
          <circle
            cx={x(i)}
            cy={y(d.value)}
            r={3}
            className="fill-accent-600 dark:fill-accent-300"
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
