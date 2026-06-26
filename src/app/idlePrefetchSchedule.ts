import type { PrefetchEntry } from '../shared/utils/prefetchOnIdle';

// Idle-prefetch schedule wired from `App.tsx` (authed) and Home.tsx
// (anon). Each entry warms the bundler cache for a click-gated
// chunk so the click itself never triggers a network fetch.
// Sequenced by likelihood of click — the dropdowns + top-3 routes
// go first; sub-pages + the activity-detail modal trail.
// `requestIdleCallback` further yields to user activity, so an
// interaction inside the 2–8s window is never starved.
//
// **Why this lives in `app/` (not `shared/`):** the schedule
// reaches into feature page chunks, which the `boundaries` rule
// forbids from `shared/`. `app/` is the layer that composes
// features, so it's the right home for cross-feature warmup.
//
// References are stable (module-scope arrow functions over module
// IDs) so the `useIdlePrefetch` entry-array identity doesn't churn
// across renders and the effect doesn't re-schedule.
export const AUTHED_PREFETCH: readonly PrefetchEntry[] = [
  // 2.0s — chrome the user almost always clicks (Settings cog +
  // Account menu live in the same TopNavMenus chunk, ~17.8 kB gz).
  {
    load: () => import('../shared/components/TopNavMenus'),
    delayMs: 2_000,
  },
  // 2.5s — most-visited route.
  {
    load: () => import('../features/transactions/pages/TransactionsPage'),
    delayMs: 2_500,
  },
  // 3.0s — 2nd most-visited route.
  {
    load: () => import('../features/budgets/pages/ExpenseTrackerPage'),
    delayMs: 3_000,
  },
  // 3.5s — 3rd most-visited route.
  {
    load: () => import('../features/taxation/pages/TaxTrackerPage'),
    delayMs: 3_500,
  },
  // 4.0s — bell + a11y cog (parallel cluster).
  {
    load: () => import('../shared/components/ActivityFeedModal'),
    delayMs: 4_000,
  },
  {
    load: () => import('../shared/components/AccessibilityPanel'),
    delayMs: 4_000,
  },
  // 4.5s — mid-traffic settings surface (re-homed under /settings).
  {
    load: () => import('../features/beneficiaries/pages/BeneficiariesPage'),
    delayMs: 4_500,
  },
  // 5.0s — lower-traffic settings surface (re-homed under /settings).
  {
    load: () => import('../features/recurring/pages/RecurringPage'),
    delayMs: 5_000,
  },
  // 5.5s — upload entry-point + the global dock that surfaces during
  // upload. UploadStatementPage also force-prefetches the dock on
  // mount as a safety net (see its useEffect).
  {
    load: () =>
      import('../features/transactions/statement_upload/pages/UploadStatementPage'),
    delayMs: 5_500,
  },
  {
    load: () =>
      import('../features/transactions/statement_upload/components/StatementUploadDock'),
    delayMs: 5_500,
  },
  // 6.0s — settings sub-pages (parallel cluster). Pages live in
  // their owning feature modules; the /settings shell just composes
  // them under one URL space (see `features/settings/settings.routes.tsx`).
  {
    load: () =>
      import('../features/categorization/pages/CategorizationRulesPage'),
    delayMs: 6_000,
  },
  {
    load: () => import('../features/bankAccounts/pages/BankAccountsPage'),
    delayMs: 6_000,
  },
  // 6.5s — remaining settings sub-pages.
  {
    load: () => import('../features/taxation/pages/TaxationRulesPage'),
    delayMs: 6_500,
  },
  {
    load: () => import('../features/tags/pages/TagsPage'),
    delayMs: 6_500,
  },
  // 7.0s — most-visited account sub-page (2FA / sessions / email change).
  {
    load: () => import('../features/account/pages/AccountSecurityPage'),
    delayMs: 7_000,
  },
  // 7.5s — remaining account sub-pages (parallel cluster; small chunks).
  {
    load: () => import('../features/account/pages/AccountProfilePage'),
    delayMs: 7_500,
  },
  {
    load: () => import('../features/account/pages/AccountPreferencesPage'),
    delayMs: 7_500,
  },
  {
    load: () => import('../features/account/pages/AccountPrivacyPage'),
    delayMs: 7_500,
  },
  {
    load: () => import('../features/account/pages/AccountAccessibilityPage'),
    delayMs: 7_500,
  },
  {
    load: () => import('../features/account/pages/AccountNotificationsPage'),
    delayMs: 7_500,
  },
  // 8.0s — only clicked from inside the open feed modal, lowest
  // priority.
  {
    load: () => import('../shared/components/ActivityDetailModal'),
    delayMs: 8_000,
  },
];
