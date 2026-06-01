import { useAuthStore } from '../../../shared/state/auth.store';
import { BreachAlertsWidget } from '../components/BreachAlertsWidget';
import { ExpenseTrackerCard } from '../components/ExpenseTrackerCard';
import { RecentActivityWidget } from '../components/RecentActivityWidget';
import { TaxTrackerCard } from '../components/TaxTrackerCard';
import { TransactionsCard } from '../components/TransactionsCard';
import { UpcomingBillsWidget } from '../components/UpcomingBillsWidget';
import { WeekSummaryWidget } from '../components/WeekSummaryWidget';

// /dashboard surface — the authenticated home. Three primary cards
// give the user a glance view of each major feature surface; three
// secondary widgets (desktop only) cluster cross-feature signals
// without competing for visual weight.
//
// Layout:
//   • Page is `max-w-6xl` — wider than feature pages (`max-w-5xl`)
//     so the 3-column primary grid breathes at desktop. Stacked
//     single-column below `lg`.
//   • Primary cards: `grid-cols-1 lg:grid-cols-3`. Each card is
//     `h-full` so the row aligns at every viewport.
//   • Secondary widgets row: same `grid-cols-1 lg:grid-cols-3` —
//     always visible across viewports. Left-to-right priority on
//     desktop maps to top-to-bottom on mobile: BreachAlerts (most
//     actionable, money-on-the-line) → WeekSummary (concrete
//     this-week stats) → RecentActivity (cross-feature feed once
//     the backend endpoint lands).
//
// No user menu / header chrome here — the authenticated app shell
// (shared/components/TopNav) carries the brand, user menu, theme
// toggle, etc. Per the Batch 6.5 shell upgrade, the dashboard's
// previous inline header is gone.
export function DashboardPage() {
  const firstName = useAuthStore((s) => s.user?.first_name);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Your week at a glance — transactions, budget headroom, and the
          running tax accrual.
        </p>
      </header>

      {/*
       * Primary cards — three glance views of the major features.
       * `items-stretch` + `h-full` on each card keeps the row
       * aligned even when one card's body is taller than the others
       * (e.g. empty state vs. populated).
       */}
      <section
        aria-label="Primary insights"
        className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3"
        data-testid="dashboard-primary-grid"
      >
        <TransactionsCard />
        <ExpenseTrackerCard />
        <TaxTrackerCard />
      </section>

      {/*
       * Secondary widgets — always visible across viewports.
       * Ordered by priority (left → right on desktop, top → bottom
       * on mobile) so the most actionable signal lands first either
       * way: breaches → week stats → activity feed.
       */}
      <section
        aria-label="Secondary widgets"
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="dashboard-secondary-grid"
      >
        <BreachAlertsWidget />
        <WeekSummaryWidget />
        <UpcomingBillsWidget />
        <RecentActivityWidget />
      </section>
    </div>
  );
}
