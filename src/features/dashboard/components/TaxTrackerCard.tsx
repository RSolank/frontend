import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import {
  fractionOfWeekElapsed,
  weekRangeInTz,
} from '../../taxation/api/billPeriod';
import {
  useTrackerCurrentWeekQuery,
  type PerTagContribution,
} from '../../taxation/api/queries';

import { DashboardCard, DashboardCardEmpty } from './DashboardCard';

// Dashboard snapshot of the in-progress week's running tax. Bespoke
// (not a drop-in of CurrentWeekTracker) — the page tracker shows a
// 4-stat grid + week progress + top-5 list; the Dashboard card needs
// a denser 2-stat header (accrued + projected) + top-3 contributors
// so the triptych stays balanced.
//
// Backend endpoint is gated behind Phase 0.7 (see
// `.scratch/task-handoff-be-to-fe.md §1`). Until then the query
// swallows 404/501 → null and the card renders the pending state
// with the active week label.
const TOP_CONTRIBUTORS_LIMIT = 3;

export function TaxTrackerCard() {
  const timezone = usePreferencesStore((s) => s.timezone);
  const { money } = useMoneyFormatter();

  const { data, isLoading } = useTrackerCurrentWeekQuery();
  const fallbackWeek = useMemo(
    () => weekRangeInTz(new Date(), timezone),
    [timezone]
  );
  const elapsedFraction = useMemo(
    () => fractionOfWeekElapsed(new Date(), timezone),
    [timezone]
  );

  if (isLoading && data == null) {
    return (
      <DashboardCard title="Tax Tracker" testId="dashboard-tax-card">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      </DashboardCard>
    );
  }

  const periodStart = data?.period_start ?? fallbackWeek.period_start;
  const periodEnd = data?.period_end ?? fallbackWeek.period_end;
  const titleChip = `${periodStart} → ${periodEnd}`;

  // Pending — backend endpoint not implemented yet OR no accrual yet.
  // We surface the same friendly empty-state copy in both cases
  // because, from the user's perspective, "nothing to show" is what
  // they see either way. A Phase 0.7 ship will turn this into the
  // populated path automatically once the endpoint lights up.
  if (data == null) {
    return (
      <DashboardCard
        title="Tax Tracker"
        titleChip={titleChip}
        pending
        testId="dashboard-tax-card"
      >
        <DashboardCardEmpty
          headline="No tax accrual yet this week"
          body="Tax accrues automatically as you add transactions. Add one to start the week's running total."
          ctaHref="/transactions?add=true"
          ctaLabel="Add transaction"
        />
      </DashboardCard>
    );
  }

  // Populated. Projection prefers the backend's value; falls back to
  // a client-side linear extrapolation by fraction-of-week-elapsed
  // (mirrors CurrentWeekTracker on the Tax Tracker page).
  const runningTotal = data.running_tax + data.running_penalty;
  const projectedTax =
    data.projected_tax > 0
      ? data.projected_tax
      : safeDivide(data.running_tax, elapsedFraction);
  const projectedPenalty =
    data.projected_penalty > 0
      ? data.projected_penalty
      : safeDivide(data.running_penalty, elapsedFraction);
  const projectedTotal = projectedTax + projectedPenalty;

  return (
    <DashboardCard
      title="Tax Tracker"
      titleChip={titleChip}
      footerHref="/consumption-tax"
      footerLabel="View bills + week detail"
      testId="dashboard-tax-card"
    >
      {data.is_estimate && (
        <p
          className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
          data-testid="dashboard-tax-estimate-banner"
        >
          Backend is returning approximate data while the live ledger backfills.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2">
        <Stat
          label="Accrued"
          value={money(runningTotal)}
          accent
          testId="dashboard-tax-accrued"
        />
        <Stat
          label="Projected"
          value={money(projectedTotal)}
          muted
          testId="dashboard-tax-projected"
        />
      </dl>

      <WeekProgress fraction={elapsedFraction} />

      <TopContributors perTag={data.per_tag} money={money} />
    </DashboardCard>
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
  testId?: string;
}

function Stat({ label, value, accent, muted, testId }: StatProps) {
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        accent
          ? 'bg-indigo-50 dark:bg-indigo-950/40'
          : 'bg-slate-50 dark:bg-slate-800/60'
      }`}
      data-testid={testId}
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
        className={`mt-0.5 text-base font-semibold tabular-nums money ${
          accent
            ? 'text-indigo-700 dark:text-indigo-200'
            : muted
              ? 'text-slate-600 dark:text-slate-300'
              : 'text-slate-900 dark:text-slate-100'
        }`}
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
          className="h-full bg-indigo-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TopContributors({
  perTag,
  money,
}: {
  perTag: PerTagContribution[];
  money: (n: number) => string;
}) {
  if (!perTag || perTag.length === 0) {
    return (
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        No taxable transactions yet this week.
      </p>
    );
  }
  const top = perTag.slice(0, TOP_CONTRIBUTORS_LIMIT);
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Top contributors
      </h3>
      <ul
        className="mt-2 flex flex-col gap-1"
        data-testid="dashboard-tax-contributors"
      >
        {top.map((p) => (
          <li
            key={p.tag_id}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900"
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
