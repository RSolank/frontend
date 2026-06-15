import { lazy, Suspense, type ReactNode } from 'react';

import {
  OTHERS_SLICE,
  SLICE_PALETTE,
  type DonutSlice,
  type TrendPoint,
} from '../../features/budgets/components/trendCharts';
import type { TrackerCurrentWeekResponse } from '../../features/taxation/api/queries';

// Landing feature-showcase strip — sits below the hero. The first two showcases
// reuse the REAL app components (rendered with fabricated data, lazy-loaded) so
// they can never visually drift from the product; the rest are screenshot
// slots the marketing screenshots drop into post-deploy.

const CurrentWeekTrackerView = lazy(() =>
  import('../../features/taxation/components/CurrentWeekTracker').then((m) => ({
    default: m.CurrentWeekTrackerView,
  }))
);
const SpendTrendView = lazy(() =>
  import('../../features/budgets/components/SpendTrendCard').then((m) => ({
    default: m.SpendTrendView,
  }))
);

// --- Fixtures (INR, the India-first default) ------------------------------

const TRACKER_FIXTURE: TrackerCurrentWeekResponse = {
  period_start: '2026-02-09',
  period_end: '2026-02-15',
  running_tax: 1240,
  running_penalty: 180,
  projected_tax: 2100,
  projected_penalty: 300,
  is_estimate: false,
  per_tag: [
    {
      tag_id: 11,
      tag_name: 'Dining',
      txn_type: 'discretionary',
      tax_amount: 520,
      penalty: 120,
    },
    {
      tag_id: 12,
      tag_name: 'Groceries',
      txn_type: 'essential',
      tax_amount: 380,
      penalty: 0,
    },
    {
      tag_id: 13,
      tag_name: 'Shopping',
      txn_type: 'discretionary',
      tax_amount: 340,
      penalty: 60,
    },
  ],
};

const TREND_POINTS: TrendPoint[] = [
  { label: 'Sep', value: 71_200 },
  { label: 'Oct', value: 88_400 },
  { label: 'Nov', value: 79_900 },
  { label: 'Dec', value: 96_100 },
  { label: 'Jan', value: 84_300 },
  { label: 'Feb', value: 82_450 },
];

const TREND_BREAKDOWN: { label: string; value: number }[] = [
  { label: 'Essentials', value: 34_600 },
  { label: 'Dining', value: 14_800 },
  { label: 'Transport', value: 9_050 },
  { label: 'Shopping', value: 8_700 },
  { label: 'Bills', value: 7_900 },
  { label: 'Others', value: 7_400 },
];

const TREND_TOTAL = TREND_BREAKDOWN.reduce((s, c) => s + c.value, 0);
const TREND_SLICES: DonutSlice[] = TREND_BREAKDOWN.map((c, i) => ({
  label: c.label,
  value: c.value,
  pct: (c.value / TREND_TOTAL) * 100,
  strokeClass: (c.label === 'Others'
    ? OTHERS_SLICE
    : SLICE_PALETTE[i % SLICE_PALETTE.length]!
  ).strokeClass,
}));
const TREND_LEGEND = TREND_BREAKDOWN.map((c, i) => ({
  label: c.label,
  pct: (c.value / TREND_TOTAL) * 100,
  dotClass: (c.label === 'Others'
    ? OTHERS_SLICE
    : SLICE_PALETTE[i % SLICE_PALETTE.length]!
  ).dotClass,
}));
const TREND_VALUES = TREND_POINTS.map((p) => p.value);
const TREND_STATS = {
  avg: Math.round(
    TREND_VALUES.reduce((s, v) => s + v, 0) / TREND_VALUES.length
  ),
  min: Math.min(...TREND_VALUES),
  max: Math.max(...TREND_VALUES),
};

// --- Layout ---------------------------------------------------------------

export function LandingShowcases() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Budgeting with built-in accountability
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
          Every expense sets a little aside for your future self — and Aevum
          shows you exactly where it goes.
        </p>
      </div>

      <div className="flex flex-col gap-16">
        <ShowcaseRow
          eyebrow="Self-tax → savings"
          title="Turn everyday spending into savings, automatically"
          copy="Every taxable spend levies a small self-imposed consumption tax — set aside as real savings. Watch this week's accrual build in real time, projected to week's end."
          visual={
            <ShowcaseFrame>
              <Suspense fallback={<Skeleton />}>
                <CurrentWeekTrackerView
                  data={TRACKER_FIXTURE}
                  elapsedFraction={0.6}
                />
              </Suspense>
            </ShowcaseFrame>
          }
        />

        <ShowcaseRow
          reverse
          eyebrow="Understand your spending"
          title="See where your money goes — trends and breakdowns"
          copy="One clean view: how your total spend moves month to month, beside a category breakdown of where it landed. Zoom from a week to two years."
          visual={
            <ShowcaseFrame>
              <Suspense fallback={<Skeleton />}>
                <SpendTrendView
                  rangeKey="6mo"
                  points={TREND_POINTS}
                  chartKind="line"
                  periodStats={TREND_STATS}
                  grainUnit="/mo"
                  rangeLabel="6M"
                  rolling={{ avg: 83_700, min: 71_200, max: 96_100 }}
                  slices={TREND_SLICES}
                  legend={TREND_LEGEND}
                />
              </Suspense>
            </ShowcaseFrame>
          }
        />

        <ShowcaseRow
          eyebrow="Stay ahead"
          title="Imports, auto-categorization & recurring forecasts"
          copy="Import a PhonePe / GPay / Paytm statement and Aevum reads it, tags it by rules you set once, and forecasts the bills it sees repeating."
          visual={<ScreenshotSlot label="Recurring & statement import" />}
        />
      </div>
    </section>
  );
}

function ShowcaseRow({
  eyebrow,
  title,
  copy,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2">
      <div className={reverse ? 'lg:order-2' : ''}>
        <div className="text-accent-700 dark:text-accent-300 text-xs font-semibold tracking-wider uppercase">
          {eyebrow}
        </div>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          {copy}
        </p>
      </div>
      <div className={reverse ? 'lg:order-1' : ''}>{visual}</div>
    </div>
  );
}

// Decorative gradient frame around a live component card.
function ShowcaseFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative p-3">
      <div
        aria-hidden="true"
        className="absolute inset-[8%] -z-10 rounded-3xl bg-gradient-to-br from-sky-200/30 via-cyan-200/20 to-emerald-200/20 blur-2xl dark:from-sky-900/20 dark:to-emerald-900/20"
      />
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="h-56 w-full animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
  );
}

// Placeholder for a marketing screenshot dropped in post-deploy (into
// `public/landing/`). Until then it renders a labelled frame, not a broken img.
function ScreenshotSlot({ label }: { label: string }) {
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
      {label} — screenshot
    </div>
  );
}
