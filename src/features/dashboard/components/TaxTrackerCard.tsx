import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  useDomainActivityQuery,
  type ActivityFeedItem,
} from '../../../shared/api/activityFeed';
import { ActivityCallout } from '../../../shared/components/ActivityCallout';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { useTaxModeStore } from '../../../shared/state/taxMode.store';
import {
  fractionOfWeekElapsed,
  weekRangeInTz,
} from '../../taxation/api/billPeriod';
import {
  useTrackerCurrentWeekQuery,
  type PerTagContribution,
  type TrackerCurrentWeekResponse,
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
//
// Tax-mode banner (B1 dashboard enrichment) — two co-operating
// layers shown whenever auto-finalize is off:
//   • Layer A (live, persistent, non-dismissible): driven by the
//     `auto_enabled` flag via `useTaxModeStore`, so it covers *both*
//     auto- and manual-disable and clears the instant the user turns
//     it back on. A quiet "turn it back on" nudge.
//   • Layer B (activity, dismissible): the louder "we just switched
//     it off after bills stacked up" notice, sourced from the
//     `tax_mode_auto_disabled` event. Dismiss hard-acks (DELETEs the
//     notification) and leaves Layer A behind — the loud→ack→quiet
//     transition.
// Stale guard: the tracker derives from the first ACCRUING bill,
// which in manual mode drifts to a *past, closed* week. When that
// happens (`isStale`) the projection + week-progress are
// date-relative and therefore invalid, so we drop them and show only
// the accrued figure (labelled with its real period) + contributors.
const TOP_CONTRIBUTORS_LIMIT = 3;

export function TaxTrackerCard() {
  const timezone = usePreferencesStore((s) => s.timezone);
  const { money } = useMoneyFormatter();
  const taxMode = useTaxModeStore((s) => s.mode);

  const { data, isLoading } = useTrackerCurrentWeekQuery();
  // One domain-scoped fetch shared (via the react-query cache) with
  // the OverdueBillsWidget — both call `useDomainActivityQuery('taxation')`.
  const domainFeed = useDomainActivityQuery('taxation');
  const fallbackWeek = useMemo(
    () => weekRangeInTz(new Date(), timezone),
    [timezone]
  );
  const elapsedFraction = useMemo(
    () => fractionOfWeekElapsed(new Date(), timezone),
    [timezone]
  );

  // Gate the loud notice on the *live* manual-state so a `tax_mode_auto_disabled`
  // event lingering after the user re-enables auto never re-shows. Only manual
  // mode nudges to re-enable auto — `off` is a deliberate full-disable.
  const autoDisabledNotice =
    taxMode === 'manual'
      ? ((domainFeed.data?.items ?? []).find(
          (i) => i.kind === 'tax_mode_auto_disabled'
        ) ?? null)
      : null;

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
        <TaxModeBanners off={taxMode !== 'auto'} notice={autoDisabledNotice} />
        <DashboardCardEmpty
          headline="No tax accrual yet this week"
          body="Tax accrues automatically as you add transactions. Add one to start the week's running total."
          ctaHref="/transactions?add=true"
          ctaLabel="Add transaction"
        />
      </DashboardCard>
    );
  }

  // The accruing bill's week has already closed (manual mode let it
  // drift past a week boundary). Projection + week-progress extrapolate
  // by *this* week's elapsed fraction against an *old* period, so they
  // are invalid — the populated body drops them and labels the accrued
  // figure honestly.
  const isStale = taxMode !== 'auto' && periodEnd < fallbackWeek.period_start;

  return (
    <DashboardCard
      title="Tax Tracker"
      titleChip={titleChip}
      footerHref="/consumption-tax"
      footerLabel="View bills + week detail"
      testId="dashboard-tax-card"
    >
      <TaxModeBanners off={taxMode !== 'auto'} notice={autoDisabledNotice} />
      <PopulatedTaxBody
        data={data}
        money={money}
        elapsedFraction={elapsedFraction}
        isStale={isStale}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />
    </DashboardCard>
  );
}

// The populated card body — split out of TaxTrackerCard so the estimate
// banner + stale/projection branches don't push the parent over the
// cyclomatic-complexity budget (same view-model split as ExpenseTrackerCard).
interface PopulatedTaxBodyProps {
  data: TrackerCurrentWeekResponse;
  money: (n: number) => string;
  elapsedFraction: number;
  isStale: boolean;
  periodStart: string;
  periodEnd: string;
}

function PopulatedTaxBody({
  data,
  money,
  elapsedFraction,
  isStale,
  periodStart,
  periodEnd,
}: PopulatedTaxBodyProps) {
  // Projection prefers the backend's value; falls back to a client-side
  // linear extrapolation by fraction-of-week-elapsed (mirrors
  // CurrentWeekTracker on the Tax Tracker page).
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
    <>
      {data.is_estimate && (
        <p
          className="border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-700/60 dark:bg-warning-950/40 dark:text-warning-200 mb-3 rounded-md border px-2 py-1 text-xs"
          data-testid="dashboard-tax-estimate-banner"
        >
          Backend is returning approximate data while the live ledger backfills.
        </p>
      )}

      {isStale ? (
        <StaleAccrued
          value={money(runningTotal)}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      ) : (
        <>
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
        </>
      )}

      <TopContributors perTag={data.per_tag} money={money} />
    </>
  );
}

// Layer A + Layer B of the tax-mode banner stack. Renders nothing when
// auto-finalize is on. The loud Layer-B notice (if present) sits above
// the quiet, persistent Layer-A nudge.
function TaxModeBanners({
  off,
  notice,
}: {
  off: boolean;
  notice: ActivityFeedItem | null;
}) {
  if (!off) return null;
  return (
    <div className="mb-3 flex flex-col gap-2">
      {notice ? (
        <ActivityCallout item={notice} testId="dashboard-tax-auto-disabled" />
      ) : null}
      <div
        className="border-warning-300 bg-warning-50 dark:border-warning-700/60 dark:bg-warning-950/40 rounded-md border px-2.5 py-2"
        data-testid="dashboard-tax-mode-off"
      >
        <p className="text-warning-800 dark:text-warning-200 text-xs font-medium">
          Auto-finalize is off — weekly bills won&apos;t be generated
          automatically.
        </p>
        <Link
          to="/account/preferences?highlight=tax-mode"
          className="text-warning-800 dark:text-warning-200 mt-1 inline-block text-xs font-semibold hover:underline"
        >
          Turn it back on →
        </Link>
      </div>
    </div>
  );
}

// Off + stale: the only accrual detail that survives a closed accruing
// week — the running total, labelled with the period it actually
// covers (the projection/progress bars are suppressed by the caller).
function StaleAccrued({
  value,
  periodStart,
  periodEnd,
}: {
  value: string;
  periodStart: string;
  periodEnd: string;
}) {
  return (
    <div
      className="bg-accent-50 dark:bg-accent-950/40 rounded-md px-3 py-2"
      data-testid="dashboard-tax-accrued"
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Accrued
      </div>
      <div className="money text-accent-700 dark:text-accent-200 mt-0.5 text-base font-semibold tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
        Week of {periodStart} → {periodEnd} · not finalized
      </div>
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
  testId?: string;
}

// Value colour by emphasis: accent (indigo) > muted (slate-600) > default
// (slate-900). if/else (not a nested ternary) so it stays off
// sonarjs/no-nested-conditional.
function statValueClass(accent?: boolean, muted?: boolean): string {
  if (accent) return 'text-accent-700 dark:text-accent-200';
  if (muted) return 'text-slate-600 dark:text-slate-300';
  return 'text-slate-900 dark:text-slate-100';
}

function Stat({ label, value, accent, muted, testId }: StatProps) {
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        accent
          ? 'bg-accent-50 dark:bg-accent-950/40'
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
            <span className="money text-sm text-slate-900 tabular-nums dark:text-slate-100">
              {money(p.tax_amount + p.penalty)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
