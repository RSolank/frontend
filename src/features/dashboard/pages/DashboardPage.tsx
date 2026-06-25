import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { Stagger, StaggerItem } from '../../../shared/motion';
import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { AnalyticsZone } from '../components/analytics/AnalyticsZone';
import { DashboardHero } from '../components/hero/DashboardHero';
import { NeedsAttentionRail } from '../components/NeedsAttentionRail';
import { TransactionsCard } from '../components/TransactionsCard';
import { UpcomingBillsWidget } from '../components/UpcomingBillsWidget';

// /dashboard — the authenticated home, re-IA'd around a narrative the user
// reads top→bottom: where you stand now (hero) → what needs attention →
// how you're trending → what's recent + coming.
//
//   ❶ HERO            — provision + savings, or (taxation off) the spend hero.
//   ❷ NEEDS ATTENTION — merged rail; renders nothing when all-clear.
//   ❸ ANALYTICS       — spend breakdown, or (off) the savings re-enable nudge.
//   ❹ ACTIVITY        — recent transactions + the 7-day upcoming-bills forecast
//                       (which IS the recurring forecast — one source, no
//                       separate widget).
//
// Entrance motion is a gentle staggered fade/rise via the shared
// `<Stagger>/<StaggerItem>` scaffold (`shared/motion`); the MotionProvider
// is now mounted app-wide (`app/providers.tsx`), so this route just
// consumes the vocabulary. Animation collapses to nothing under reduced
// motion, and content is fully rendered regardless — motion never gates the
// paint. The attention rail sits outside the stagger so urgent signals
// appear immediately.

export function DashboardPage() {
  const firstName = useAuthStore((s) => s.user?.first_name);
  const timezone = usePreferencesStore((s) => s.timezone);
  useMoneyFormatter(); // warm the currency symbol for the child cards

  const week = useMemo(() => weekRangeInTz(new Date(), timezone), [timezone]);
  const dayMonth = (isoDate: string) =>
    formatDate(`${isoDate}T12:00:00Z`, timezone, {
      month: 'short',
      day: 'numeric',
    });
  const weekLabel = `${dayMonth(week.period_start)} – ${dayMonth(week.period_end)}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Week of {weekLabel}
        </p>
      </header>

      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <DashboardHero />
        </StaggerItem>

        {/* Outside the stagger — urgent, shows immediately (or not at all). */}
        <NeedsAttentionRail />

        <StaggerItem>
          <AnalyticsZone />
        </StaggerItem>

        <StaggerItem
          className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
          data-testid="dashboard-activity-zone"
        >
          <TransactionsCard />
          <UpcomingBillsWidget />
        </StaggerItem>
      </Stagger>
    </div>
  );
}
