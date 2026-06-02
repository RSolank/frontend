import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { fractionOfWeekElapsed } from '../api/billPeriod';
import {
  useTrackerCurrentWeekQuery,
  type PerTagContribution,
  type TrackerCurrentWeekResponse,
} from '../api/queries';

// Single-card surface for the in-progress week's tax accrual. Reads
// `/api/consumption-tax/tracker/current-week` (shipped BE Phase 2.6,
// `e7c05aa` — see `task-platform.md → taxation.tracker-current-week`).
//
// Read-only by design — no mutation paths, no generate/pay actions
// live here. The bills list below this card handles those. This is
// the live-accrual view; bills are the settled history.
export function CurrentWeekTracker() {
  const timezone = usePreferencesStore((s) => s.timezone);
  const { money } = useMoneyFormatter();
  const { data, isLoading } = useTrackerCurrentWeekQuery();

  const elapsedFraction = useMemo(
    () => fractionOfWeekElapsed(new Date(), timezone),
    [timezone]
  );

  if (isLoading || !data) {
    return (
      <section
        aria-labelledby="tracker-heading"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h3 id="tracker-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          This week — running tax
        </h3>
        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      </section>
    );
  }

  const projectedTax =
    data.projected_tax > 0
      ? data.projected_tax
      : safeDivide(data.running_tax, elapsedFraction);
  const projectedPenalty =
    data.projected_penalty > 0
      ? data.projected_penalty
      : safeDivide(data.running_penalty, elapsedFraction);

  return (
    <section
      aria-labelledby="tracker-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="tracker-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          This week — running tax
        </h3>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {data.period_start} → {data.period_end}
        </span>
      </header>

      {data.is_estimate && (
        <p className="mt-2 rounded-md border border-warning-300 bg-warning-50 px-3 py-1.5 text-xs text-warning-800 dark:border-warning-700/60 dark:bg-warning-950/40 dark:text-warning-200">
          Showing approximate accrual while the live ledger backfills
          historic weeks — totals settle once a fresh full week has accrued.
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Accrued tax" value={money(data.running_tax)} accent />
        <Stat label="Accrued penalty" value={money(data.running_penalty)} />
        <Stat label="Projected tax" value={money(projectedTax)} muted />
        <Stat label="Projected penalty" value={money(projectedPenalty)} muted />
      </dl>

      <WeekProgress fraction={elapsedFraction} />

      <PerTagBreakdown perTag={data.per_tag} money={money} />
    </section>
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
        className={`mt-0.5 text-base font-semibold tabular-nums money ${statValueClass(
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
          className="h-full bg-accent-500 transition-[width] duration-300"
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
            <span className="tabular-nums text-sm text-slate-900 money dark:text-slate-100">
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
