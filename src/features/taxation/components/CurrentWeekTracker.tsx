import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { fractionOfWeekElapsed } from '../api/billPeriod';
import {
  useTrackerCurrentWeekQuery,
  type PerTagContribution,
  type TrackerCurrentWeekResponse,
} from '../api/queries';

// Single-card surface for the in-progress week's tax accrual.
//
// **Data source (rewritten 2026-06-06):** the previously-spec'd
// `GET /api/v1/consumption-tax/tracker/current-week` route was never
// shipped on the backend despite the coord doc marking Phase 2.6 as
// LANDED; every call 404'd, the component's `isLoading || !data`
// guard rendered "Loading…" forever. `useTrackerCurrentWeekQuery`
// now derives the response shape from the ACCRUING bill (the
// engine maintains it incrementally on every txn mutation), so the
// card lights up without a BE round trip. `data === null` is the
// settled "no in-progress bill yet" state — render the empty card.
//
// Read-only by design — no mutation paths, no generate/pay actions
// live here. The bills list below this card handles those.
export function CurrentWeekTracker() {
  const timezone = usePreferencesStore((s) => s.timezone);
  const { data, isLoading, isError } = useTrackerCurrentWeekQuery();

  const elapsedFraction = useMemo(
    () => fractionOfWeekElapsed(new Date(), timezone),
    [timezone]
  );

  if (isLoading) {
    return (
      <CardShell>
        <CardBody copy="Loading…" />
      </CardShell>
    );
  }

  // BE error or no in-progress bill yet → friendly empty state.
  // Covers both "user has no txns this week" and any transient 5xx
  // — the user shouldn't see "Loading…" hang forever in either case.
  if (isError || !data) {
    return (
      <CardShell>
        <CardBody copy="No tax accrued for this week yet." />
      </CardShell>
    );
  }

  return (
    <CurrentWeekTrackerView data={data} elapsedFraction={elapsedFraction} />
  );
}

// The populated-card render, split out so it can be rendered with fabricated
// data (the landing-page showcase) without the network round-trip.
export function CurrentWeekTrackerView({
  data,
  elapsedFraction,
}: {
  data: TrackerCurrentWeekResponse;
  elapsedFraction: number;
}) {
  const { money } = useMoneyFormatter();
  const projectedTax =
    data.projected_tax > 0
      ? data.projected_tax
      : safeDivide(data.running_tax, elapsedFraction);
  const projectedPenalty =
    data.projected_penalty > 0
      ? data.projected_penalty
      : safeDivide(data.running_penalty, elapsedFraction);

  return (
    <CardShell
      header={
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {data.period_start} → {data.period_end}
        </span>
      }
    >
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Accrued tax" value={money(data.running_tax)} accent />
        <Stat label="Accrued penalty" value={money(data.running_penalty)} />
        <Stat label="Projected tax" value={money(projectedTax)} muted />
        <Stat label="Projected penalty" value={money(projectedPenalty)} muted />
      </dl>

      <WeekProgress fraction={elapsedFraction} />

      <PerTagBreakdown perTag={data.per_tag} money={money} />
    </CardShell>
  );
}

interface CardShellProps {
  header?: React.ReactNode;
  children: React.ReactNode;
}

function CardShell({ header, children }: CardShellProps) {
  return (
    <section
      aria-labelledby="tracker-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id="tracker-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          This week — running tax
        </h3>
        {header}
      </header>
      {children}
    </section>
  );
}

function CardBody({ copy }: { copy: string }) {
  return (
    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
      {copy}
    </div>
  );
}

function safeDivide(numerator: number, fraction: number): number {
  if (!Number.isFinite(fraction) || fraction <= 0) return numerator;
  return numerator / fraction;
}

interface StatProps {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}

// Value colour by emphasis: accent (indigo) > muted (slate-600) > default
// (slate-900). if/else (not a nested ternary) so it stays off
// sonarjs/no-nested-conditional.
function statValueClass(accent?: boolean, muted?: boolean): string {
  if (accent) return 'text-accent-700 dark:text-accent-200';
  if (muted) return 'text-slate-600 dark:text-slate-300';
  return 'text-slate-900 dark:text-slate-100';
}

function Stat({ label, value, accent, muted }: StatProps) {
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        accent
          ? 'bg-accent-50 dark:bg-accent-950/40'
          : 'bg-slate-50 dark:bg-slate-800/60'
      }`}
    >
      <div
        className={`text-xs font-medium ${
          muted
            ? 'text-slate-400 dark:text-slate-500'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {label}
      </div>
      <div
        className={`money mt-0.5 text-base font-semibold tabular-nums ${statValueClass(
          accent,
          muted
        )}`}
      >
        {value}
      </div>
    </div>
  );
}

function WeekProgress({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  return (
    <div className="mt-3" aria-label={`Week ${pct}% elapsed`}>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Week progress</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="bg-accent-500 h-full transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PerTagBreakdown({
  perTag,
  money,
}: {
  perTag: PerTagContribution[];
  money: (n: number) => string;
}) {
  if (!perTag || perTag.length === 0) return null;
  const top = perTag.slice(0, 5);
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Top contributors this week
      </h4>
      <ul className="mt-2 flex flex-col gap-1">
        {top.map((p) => (
          <li
            key={p.tag_id}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">{p.tag_name}</span>
              <span className="ml-2 text-xs text-slate-500 capitalize dark:text-slate-400">
                {p.txn_type}
              </span>
            </div>
            <span className="money text-sm text-slate-900 tabular-nums dark:text-slate-100">
              {money(p.tax_amount + p.penalty)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Re-export shape for tests / siblings that want to render a
// pre-populated tracker without hitting the network.
export type { TrackerCurrentWeekResponse };
