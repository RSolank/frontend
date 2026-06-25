import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  RotateCw,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';

import type { BudgetCategory } from '../../features/budgets/api/queries';
import type { OverviewTopCategory } from '../../features/budgets/components/ExpenseOverviewCard';
import { TransactionsCardView } from '../../features/dashboard/components/TransactionsCard';
import { UpcomingBillsView } from '../../features/dashboard/components/UpcomingBillsWidget';
import type { RecurringBill } from '../../features/recurring/api/schemas';
import type { TrackerCurrentWeekResponse } from '../../features/taxation/api/queries';
import type { TransactionDTO } from '../../features/transactions/api/schemas';
import { SavingsComposition } from '../../features/treasury/components/SavingsComposition';
import {
  OTHERS_SLICE,
  SLICE_PALETTE,
  type DonutSlice,
  type TrendPoint,
} from '../../shared/components/charts/trendCharts';
import { useMoneyFormatter } from '../../shared/hooks/useMoneyFormatter';
import { Reveal } from '../../shared/motion';

// Landing feature-showcase strip — sits below the hero. Every showcase reuses a
// REAL app component, rendered with fabricated data (the chart-heavy ones lazy),
// so the marketing surface can never visually drift from the product. Two
// full-width "marquee" rows lead (label on top, cards full width below), then a
// denser 2-up grid of secondary stories.

const ExpenseOverviewView = lazy(() =>
  import('../../features/budgets/components/ExpenseOverviewCard').then((m) => ({
    default: m.ExpenseOverviewView,
  }))
);
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
// One coherent persona's data across the strip: a calm, in-control month.

const TZ = 'Asia/Kolkata';

// Expense-tracker overview — this month's spend (the "spend" beat of the cycle).
const EXPENSE_MONTH = '2026-02';
const EXPENSE_TOTAL: BudgetCategory = {
  tag_id: 1,
  tag_name: 'Total Budget',
  tag_type: 'total',
  current_debit: 82_450,
  current_credit: 0,
  current_net_expense: 82_450,
  avg_net_expense: 86_800,
  min_net_expense: 61_000,
  max_net_expense: 98_000,
  limit_amt: 150_000,
  penalty_rate: null,
  default_penalty_rate: null,
};
const EXPENSE_TOP: OverviewTopCategory[] = [
  { tag_id: 11, tag_name: 'Essentials', pctOfTotal: 42 },
  { tag_id: 12, tag_name: 'Dining', pctOfTotal: 18 },
  { tag_id: 13, tag_name: 'Transport', pctOfTotal: 11 },
];

// The self-tax accruing this week (the "self-tax" beat of the cycle).
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

// Set-aside split (the "set aside" beat) — reconciles with the hero's 48,200
// funded balance: 42,000 gained from self-tax + 6,200 the user added on top.
const COMPOSITION_RECOGNIZED = 42_000;
const COMPOSITION_DEFERRED = 6_200;

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

// Upcoming bills — the next 7 days, matching the tracker's Feb 9–15 week.
const BEN_NAMES = new Map<number, string>([
  [101, 'Rent'],
  [102, 'Electricity'],
  [103, 'Netflix'],
  [104, 'Airtel Postpaid'],
  [105, 'Gym membership'],
]);
const UPCOMING_BILLS: RecurringBill[] = [
  bill(1, 101, 18_500, '2026-02-10'),
  bill(2, 102, 2_420, '2026-02-12'),
  bill(3, 103, 649, '2026-02-13'),
  bill(4, 104, 999, '2026-02-14'),
  bill(5, 105, 1_500, '2026-02-15'),
];
function bill(
  uid: number,
  beneficiary_id: number,
  expected_amount: number,
  due_date: string
): RecurringBill {
  return {
    uid,
    template_id: uid,
    beneficiary_id,
    expected_amount,
    debit_credit: 'debit',
    due_date,
    status: 'pending',
    matched_txn_id: null,
  };
}

// Recent transactions — the five latest debits in the active week.
const TXN_RECENT: TransactionDTO[] = [
  txn(1, 'Blue Tokai Coffee', 480, '2026-02-14', 'manual'),
  txn(2, 'BigBasket', 2_340, '2026-02-14', 'statement'),
  txn(3, 'Uber', 268, '2026-02-13', 'statement'),
  txn(4, 'Amazon', 1_799, '2026-02-13', 'statement'),
  txn(5, 'Swiggy', 642, '2026-02-12', 'statement'),
];
function txn(
  txn_id: number,
  beneficiary_name: string,
  amount: number,
  txn_date: string,
  source: 'manual' | 'statement'
): TransactionDTO {
  return {
    txn_id,
    txn_date,
    beneficiary_name,
    amount,
    debit_credit: 'debit',
    source,
    tag_ids: [],
  };
}
const TXN_WEEK_TOTAL = TXN_RECENT.reduce((s, t) => s + t.amount, 0);
const TXN_WEEK_COUNT = TXN_RECENT.length;

// --- Layout ---------------------------------------------------------------

export function LandingShowcases() {
  const { money } = useMoneyFormatter();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <Reveal className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Budgeting with built-in accountability
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
          Track your spending, set aside savings automatically, and stay ahead
          of upcoming bills — Aevum keeps you posted on everything your money
          does, in one place.
        </p>
      </Reveal>

      <div className="flex flex-col gap-16">
        <MarqueeRow
          eyebrow="The cycle"
          title="Spend, self-tax, set aside — on repeat"
          copy="Each taxable spend levies a small self-imposed tax, quietly set aside as real savings. A month's spend flows down into the set-aside, beside the self-tax engine that drives it — and the loop repeats every week."
        >
          {/* The loop: spend (ET) → self-tax (tracker) → set aside (composition)
              → back to spend. On lg the tracker spans + centers between the
              ET-top and composition-bottom so the three cards read as a cycle,
              with positioned arrows; on mobile everything stacks linearly with
              in-flow down/repeat connectors. */}
          <div className="relative grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto] lg:gap-x-20">
            <div className="lg:col-start-1 lg:row-start-1">
              <ShowcaseFrame>
                <Suspense fallback={<Skeleton />}>
                  <ExpenseOverviewView
                    month={EXPENSE_MONTH}
                    total={EXPENSE_TOTAL}
                    deltaPct={-0.05}
                    topCategories={EXPENSE_TOP}
                    moreCount={0}
                  />
                </Suspense>
              </ShowcaseFrame>
            </div>

            <CycleStep
              icon="down"
              label="a small self-tax"
              className="lg:hidden"
            />

            <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-center">
              <ShowcaseFrame>
                <Suspense fallback={<Skeleton />}>
                  <CurrentWeekTrackerView
                    data={TRACKER_FIXTURE}
                    elapsedFraction={0.6}
                  />
                </Suspense>
              </ShowcaseFrame>
            </div>

            <CycleStep
              icon="down"
              label="sets a little aside"
              className="lg:hidden"
            />

            <div className="lg:col-start-1 lg:row-start-3">
              <ShowcaseFrame>
                <SavingsComposition
                  recognized={COMPOSITION_RECOGNIZED}
                  deferred={COMPOSITION_DEFERRED}
                  money={money}
                />
              </ShowcaseFrame>
            </div>

            <CycleStep
              icon="repeat"
              label="…and it repeats, every week"
              className="lg:hidden"
            />

            {/* lg-only loop. The two diagonal arrows sit in the column gutter
                (ET → tracker down-right at the top, tracker → composition
                down-left at the bottom); the cyclical repeat lives in its own
                grid gutter row between ET and composition, so it lands in the
                gap rather than on a card. */}
            <CycleArrow
              icon={ArrowDownRight}
              label="self-tax"
              className="top-[30%] left-1/2"
            />
            <CycleArrow
              icon={ArrowDownLeft}
              label="set aside"
              className="top-[75%] left-1/2"
            />
            <div className="hidden lg:col-start-1 lg:row-start-2 lg:flex lg:justify-center">
              <CycleChip icon={RotateCw} label="repeats" />
            </div>
          </div>
        </MarqueeRow>

        <MarqueeRow
          eyebrow="Understand your spending"
          title="See where your money goes — trends and breakdowns"
          copy="One clean view: how your total spend moves month to month, beside a category breakdown of where it landed. Zoom from a week to two years."
        >
          <ShowcaseFrame>
            <Suspense fallback={<Skeleton />}>
              <SpendTrendView
                rangeKey="6mo"
                points={TREND_POINTS}
                chartKind="line"
                periodStats={TREND_STATS}
                grain="monthly"
                grainUnit="/mo"
                rangeLabel="Last 6 months"
                rolling={{ avg: 83_700, min: 71_200, max: 96_100 }}
                slices={TREND_SLICES}
                legend={TREND_LEGEND}
              />
            </Suspense>
          </ShowcaseFrame>
        </MarqueeRow>
      </div>

      <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 sm:grid-rows-[auto_auto]">
        <ShowcaseCard
          eyebrow="Every rupee logged"
          title="Your activity at a glance"
          copy="Add it by hand or import a PhonePe / GPay / Paytm statement — every transaction is tagged and totalled, with this week's spend up top."
          visual={
            <TransactionsCardView
              recentTxns={TXN_RECENT}
              weekTotal={TXN_WEEK_TOTAL}
              weekCount={TXN_WEEK_COUNT}
              money={money}
              timezone={TZ}
              titleChip="Feb 9 → Feb 15"
              displayOnly
            />
          }
        />
        <ShowcaseCard
          eyebrow="Stay ahead"
          title="Know what's coming"
          copy="Aevum forecasts the bills it sees repeating — rent, utilities, subscriptions — so nothing lands as a surprise."
          visual={
            <UpcomingBillsView
              bills={UPCOMING_BILLS}
              benNames={BEN_NAMES}
              money={money}
              timezone={TZ}
              displayOnly
            />
          }
        />
      </div>
    </section>
  );
}

// A full-width marquee row: the label block sits on top, the visual(s) span the
// full width below (so data-dense cards like the spend trend read at a proper
// size instead of being squeezed into a half-width column). Its own <Reveal>
// scroll-reveals the block and orchestrates the two-beat for the marks inside.
function MarqueeRow({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <Reveal>
      <div className="mb-6 max-w-2xl">
        <ShowcaseCopy eyebrow={eyebrow} title={title} copy={copy} />
      </div>
      {children}
    </Reveal>
  );
}

// A secondary story in the 2-up grid: copy stacked over the live card. Its own
// <Reveal> so it scroll-reveals (and drives the two-beat for the count-up inside
// the transactions card) as it enters. On sm+ it's a `grid-rows-subgrid` item
// spanning the parent's two rows (copy row, card row) — so both cards' copy
// blocks share a row height and the cards' TOPS line up despite copy of
// different lengths.
function ShowcaseCard({
  eyebrow,
  title,
  copy,
  visual,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: ReactNode;
}) {
  return (
    <Reveal className="flex flex-col gap-4 sm:row-span-2 sm:grid sm:grid-rows-subgrid sm:gap-4">
      <div>
        <ShowcaseCopy eyebrow={eyebrow} title={title} copy={copy} />
      </div>
      <ShowcaseFrame>{visual}</ShowcaseFrame>
    </Reveal>
  );
}

// In-flow connector for the MOBILE linear stack — a down arrow for the flow
// (spend → self-tax → set aside) and a loop icon for the repeat. Hidden on lg
// (the desktop layout uses positioned CycleArrows instead).
function CycleStep({
  icon,
  label,
  className = '',
}: {
  icon: 'down' | 'repeat';
  label: string;
  className?: string;
}) {
  const Icon = icon === 'repeat' ? RotateCw : ArrowDown;
  return (
    <div
      className={`text-accent-700 dark:text-accent-300 flex items-center justify-center gap-2 text-xs font-medium ${className}`}
    >
      <Icon size={14} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

// The loop-connector pill (icon + label). Background + border let it bridge the
// gap between two cards cleanly. Used in-flow (the cyclical gutter cell) or
// wrapped by CycleArrow for absolute placement.
function CycleChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="border-accent-200 text-accent-700 dark:border-accent-900 dark:text-accent-200 inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-sm dark:bg-slate-900">
      <Icon size={14} strokeWidth={2.25} />
      {label}
    </span>
  );
}

// A single lg-only diagonal connector — a CycleChip absolutely positioned in the
// cycle grid (the `className` carries its top/left placement) and centered on its
// anchor via a -50/-50 translate. Decorative — the mobile connectors + copy carry
// the meaning for assistive tech.
function CycleArrow({
  icon,
  label,
  className,
}: {
  icon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute hidden -translate-x-1/2 -translate-y-1/2 lg:block ${className}`}
    >
      <CycleChip icon={icon} label={label} />
    </div>
  );
}

function ShowcaseCopy({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <>
      <div className="text-accent-700 dark:text-accent-300 text-xs font-semibold tracking-wider uppercase">
        {eyebrow}
      </div>
      <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
        {copy}
      </p>
    </>
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
