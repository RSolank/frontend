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
  useBudgetStatusQuery,
  type BudgetCategory,
} from '../../budgets/api/queries';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { useBillsQuery } from '../../taxation/api/queries';

// Zone ❷ — one prioritized rail that merges every "needs your attention"
// signal the old dashboard scattered across three boxes (BreachAlertsWidget,
// OverdueBillsWidget, the TaxTracker tax-mode banner). Priority top→bottom:
// overdue bills (money owed, time-critical) → budget breaches → the tax-mode
// nudge (a standing setting, least urgent).
//
// Collapses to nothing when all-clear: the rail renders zero DOM when there's
// no breach, no overdue bill, and auto-finalize is on — empty space beats an
// empty "all clear" card.
const DOMAIN = 'taxation';
const FEED_LIMIT = 10;

export function NeedsAttentionRail() {
  const { money } = useMoneyFormatter();
  const taxMode = useTaxModeStore((s) => s.mode);
  const timezone = usePreferencesStore((s) => s.timezone);
  const { data: budget } = useBudgetStatusQuery(null);
  const { data: feed } = useDomainActivityQuery(DOMAIN, FEED_LIMIT);
  const { data: billsData } = useBillsQuery();

  const breached = useMemo<BudgetCategory[]>(
    () =>
      (budget?.categories ?? [])
        .filter(
          (c) =>
            c.limit_amt != null &&
            c.limit_amt > 0 &&
            (c.current_net_expense ?? 0) > c.limit_amt
        )
        .sort(
          (a, b) =>
            (b.current_net_expense ?? 0) / (b.limit_amt ?? 1) -
            (a.current_net_expense ?? 0) / (a.limit_amt ?? 1)
        ),
    [budget]
  );

  const overdue = useMemo(
    () => (feed?.items ?? []).filter((i) => i.kind === 'bill_overdue'),
    [feed]
  );

  // The loud "we auto-switched it off" notice only applies in manual mode (an
  // `off` user opted out deliberately); gate on the live mode so a lingering
  // event never re-shows after re-enabling.
  const autoDisabled =
    taxMode === 'manual'
      ? ((feed?.items ?? []).find(
          (i) => i.kind === 'tax_mode_auto_disabled'
        ) ?? null)
      : null;

  const modeOff = taxMode !== 'auto';

  // Manual mode only: a *completed* week whose bill was never finalized still
  // sits ACCRUING (in auto the Monday worker would have generated it). The
  // current week's ACCRUING bill is legitimately in progress, so we key off
  // `period_end < this-week-start` — a past, un-generated week. Prompts the user
  // to generate; hidden when only the current week is still accruing and every
  // prior week already has its bill.
  const needsGenerate = useMemo(() => {
    if (taxMode !== 'manual') return false;
    const weekStart = weekRangeInTz(new Date(), timezone).period_start;
    return (billsData?.bills ?? []).some(
      (b) => b.status === 'ACCRUING' && b.period_end < weekStart
    );
  }, [taxMode, timezone, billsData]);

  // All-clear → render nothing.
  if (
    overdue.length === 0 &&
    breached.length === 0 &&
    !modeOff &&
    !needsGenerate
  )
    return null;

  return (
    <section
      data-testid="dashboard-attention-rail"
      aria-label="Needs attention"
      className="flex flex-col gap-3"
    >
      {overdue.length > 0 ? <OverdueBlock items={overdue} /> : null}
      {breached.length > 0 ? (
        <BreachBlock breached={breached} money={money} />
      ) : null}
      {needsGenerate ? <GenerateBillsBlock /> : null}
      {modeOff ? <TaxModeBlock notice={autoDisabled} /> : null}
    </section>
  );
}

// Manual-mode nudge: a completed week's bill is still un-generated. Actionable,
// so it sits above the standing "auto-finalize is off" reminder. Links to the
// Tax Tracker, where the generate flow (GenerateBillsDialog) lives.
function GenerateBillsBlock() {
  return (
    <div
      className="border-warning-300 bg-warning-50 dark:border-warning-700/60 dark:bg-warning-950/40 rounded-lg border px-3 py-2 shadow-sm"
      data-testid="dashboard-generate-bills"
    >
      <p className="text-warning-800 dark:text-warning-200 text-xs font-medium">
        A completed week&apos;s bills haven&apos;t been generated yet.
      </p>
      <Link
        to="/consumption-tax?highlight=generate-bills"
        className="text-warning-800 dark:text-warning-200 mt-1 inline-block text-xs font-semibold hover:underline"
      >
        Generate bills →
      </Link>
    </div>
  );
}

function OverdueBlock({ items }: { items: ActivityFeedItem[] }) {
  return (
    <div
      data-testid="dashboard-overdue-bills"
      className="border-danger-300 bg-danger-50 dark:border-danger-800/60 dark:bg-danger-950/30 rounded-lg border p-3 shadow-sm"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-danger-800 dark:text-danger-200 text-sm font-semibold">
          Overdue bills
        </h3>
        <span className="text-danger-700 dark:text-danger-300 text-xs font-medium">
          {items.length} overdue
        </span>
      </header>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${item.uid}-${item.kind}`}>
            <ActivityCallout
              item={item}
              testId={`dashboard-overdue-${item.subject_id}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BreachBlock({
  breached,
  money,
}: {
  breached: BudgetCategory[];
  money: (n: number | null | undefined) => string;
}) {
  return (
    <div
      data-testid="dashboard-breach-alerts"
      className="border-danger-300 bg-danger-50 dark:border-danger-800/60 dark:bg-danger-950/30 rounded-lg border p-3 shadow-sm"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-danger-800 dark:text-danger-200 text-sm font-semibold">
          Budget breaches
        </h3>
        <span className="text-danger-700 dark:text-danger-300 text-xs font-medium">
          {breached.length} this month
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {breached.map((c) => {
          const limit = c.limit_amt as number;
          const over = (c.current_net_expense ?? 0) - limit;
          return (
            <li
              key={c.tag_id}
              className="flex items-center justify-between gap-2 text-xs"
              data-testid={`dashboard-breach-${c.tag_id}`}
            >
              <span className="text-danger-900 dark:text-danger-100 truncate font-medium">
                {c.tag_name}
              </span>
              <span className="text-danger-800 money dark:text-danger-200 shrink-0 tabular-nums">
                +{money(over)} over
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        to="/budgets"
        className="text-danger-800 dark:text-danger-200 mt-2 inline-block text-xs font-semibold hover:underline"
      >
        Review budgets →
      </Link>
    </div>
  );
}

function TaxModeBlock({ notice }: { notice: ActivityFeedItem | null }) {
  return (
    <div className="flex flex-col gap-2">
      {notice ? (
        <ActivityCallout item={notice} testId="dashboard-tax-auto-disabled" />
      ) : null}
      <div
        className="border-warning-300 bg-warning-50 dark:border-warning-700/60 dark:bg-warning-950/40 rounded-lg border px-3 py-2 shadow-sm"
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
