import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { ProgressBar } from '../../../../shared/components/charts/ProgressBar';
import { CountUpNumber } from '../../../../shared/components/CountUpNumber';
import { useMoneyFormatter } from '../../../../shared/hooks/useMoneyFormatter';
import { useCountUp } from '../../../../shared/motion';
import { usePreferencesStore } from '../../../../shared/state/preferences.store';
import {
  fractionOfWeekElapsed,
  weekRangeInTz,
} from '../../../taxation/api/billPeriod';
import { useTrackerCurrentWeekQuery } from '../../../taxation/api/queries';

import { HeroNumber } from './HeroNumber';
import { HeroShell } from './HeroShell';

function safeDivide(numerator: number, fraction: number): number {
  if (!Number.isFinite(fraction) || fraction <= 0) return numerator;
  return numerator / fraction;
}

// Hero-left (normal mode): the app's signature metric — the self-tax the user
// has provisioned this week. Big accrued figure (count-up), the projection to
// Sunday, and a week-progress bar. The tax-mode banners that the old
// TaxTrackerCard carried have moved out to the NeedsAttentionRail; the hero
// stays purely about the number. Reads the same current-week tracker the Tax
// Tracker page uses; deep-links there.
export function ProvisionHeroCard() {
  const timezone = usePreferencesStore((s) => s.timezone);
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
      <HeroShell eyebrow="Provisioned this week" testId="dashboard-hero-provision">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      </HeroShell>
    );
  }

  const periodStart = data?.period_start ?? fallbackWeek.period_start;
  const periodEnd = data?.period_end ?? fallbackWeek.period_end;

  // No accrual yet this week (or the endpoint hasn't lit up) — invite the first
  // transaction rather than show a bare ₹0 hero.
  if (data == null) {
    return (
      <HeroShell
        eyebrow="Provisioned this week"
        footer={{ href: '/consumption-tax', label: 'Tax Tracker' }}
        testId="dashboard-hero-provision"
      >
        <HeroNumber
          value={0}
          testId="dashboard-hero-provision-accrued"
          className="text-accent-700 dark:text-accent-200 text-4xl font-semibold"
        />
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Tax accrues as you add transactions.{' '}
          <Link
            to="/transactions?add=true"
            className="text-accent-600 dark:text-accent-300 font-medium hover:underline"
          >
            Add one
          </Link>{' '}
          to start the week.
        </p>
      </HeroShell>
    );
  }

  const accrued = data.running_tax + data.running_penalty;
  const projectedTax =
    data.projected_tax > 0
      ? data.projected_tax
      : safeDivide(data.running_tax, elapsedFraction);
  const projectedPenalty =
    data.projected_penalty > 0
      ? data.projected_penalty
      : safeDivide(data.running_penalty, elapsedFraction);
  const projectedTotal = projectedTax + projectedPenalty;

  // Manual mode can let the accruing bill's week drift into the past; then the
  // elapsed-fraction projection extrapolates an old period and is meaningless,
  // so we drop it and label the accrued figure with the week it really covers.
  const isStale = periodEnd < fallbackWeek.period_start;

  return (
    <HeroShell
      eyebrow="Provisioned this week"
      footer={{ href: '/consumption-tax', label: 'Tax Tracker' }}
      testId="dashboard-hero-provision"
    >
      <HeroNumber
        value={accrued}
        testId="dashboard-hero-provision-accrued"
        className="text-accent-700 dark:text-accent-200 text-4xl font-semibold"
      />

      {isStale ? (
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Week of {periodStart} → {periodEnd} · not finalized
        </p>
      ) : (
        <>
          <p
            className="mt-2 text-xs text-slate-500 dark:text-slate-400"
            data-testid="dashboard-hero-provision-projected"
          >
            Projected by Sunday <ProjectedAmount value={projectedTotal} />
          </p>
          <WeekProgress fraction={elapsedFraction} />
        </>
      )}
    </HeroShell>
  );
}

// The "projected by Sunday" figure — a count-up, mirroring HeroNumber, so it
// runs to its target as a second beat after the card lands (it sits inside
// the hero's <StaggerItem>). Snaps under reduced motion.
function ProjectedAmount({ value }: { value: number }) {
  const { money } = useMoneyFormatter();
  return (
    <CountUpNumber
      value={value}
      format={money}
      className="money font-semibold text-slate-700 tabular-nums dark:text-slate-200"
    />
  );
}

function WeekProgress({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  // Grow the bar (and its label) from 0 to the elapsed fraction as the
  // second beat — driven by the framer-free count-up (gated on the card
  // landing, snaps under reduced motion), so the fill actually runs rather
  // than appearing at its final width.
  const shown = Math.round(useCountUp(pct));
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Week progress</span>
        <span className="tabular-nums">{shown}%</span>
      </div>
      <ProgressBar
        value={pct}
        className="mt-1"
        ariaLabel={`Week ${pct}% elapsed`}
      />
    </div>
  );
}
