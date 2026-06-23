import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { accountRoutes } from '../features/account/account.routes';
import { adminRoutes } from '../features/admin/admin.routes';
import { authRoutes } from '../features/auth/auth.routes';
import { beneficiariesRoutes } from '../features/beneficiaries/beneficiaries.routes';
import { budgetsRoutes } from '../features/budgets/budgets.routes';
import { dashboardRoutes } from '../features/dashboard/dashboard.routes';
import { recurringRoutes } from '../features/recurring/recurring.routes';
import { settingsRoutes } from '../features/settings/settings.routes';
import { taxationRoutes } from '../features/taxation/taxation.routes';
import { transactionsRoutes } from '../features/transactions/transactions.routes';
import { treasuryRoutes } from '../features/treasury/treasury.routes';

import { App } from './App';
import { HomePage } from './pages/Home';
import { NotFoundPage } from './pages/NotFound';
import { protectedRoutes } from './routeHelpers';

// Help is a content-heavy doc-style page hit by a small minority of
// sessions (TopNav link, not a primary surface) — lazy-load it to
// keep first-paint under the 125 kB JS ceiling.
const HelpPage = lazy(() =>
  import('./pages/Help').then((m) => ({ default: m.HelpPage }))
);

// `/account/cancel-deletion` is unauthenticated by design — the user
// IS logged out while the BE central lock is active, and the email
// link is the canonical entry point. Lives outside `accountRoutes`
// (which sit inside ProtectedRoute) so reaching it doesn't bounce
// through the login gate.
const CancelDeletionPage = lazy(() =>
  import('../features/account/pages/CancelDeletionPage').then((m) => ({
    default: m.CancelDeletionPage,
  }))
);
// BE Phase 2.3 — one-click revoke link from the new-device email.
// Unauthenticated by design (the user is presumed locked out of the
// just-revoked device); same shell as `/account/cancel-deletion`.
const RevokeDevicePage = lazy(() =>
  import('../features/account/pages/RevokeDevicePage').then((m) => ({
    default: m.RevokeDevicePage,
  }))
);

// Public-facing routes (no auth gate). The auth feature owns /login and
// /register from Batch 2 onwards.
const publicRoutes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/help', element: <HelpPage /> },
  { path: '/account/cancel-deletion', element: <CancelDeletionPage /> },
  { path: '/account/revoke-device', element: <RevokeDevicePage /> },
  ...authRoutes,
];

// Routes that require an authenticated user. Wrapped in <ProtectedRoute>
// via the protectedRoutes() helper so feature batches just append to
// this list without remembering to wrap each entry. The settings shell
// (Batch 9) owns /settings/* and the /categories + /categorization-rules
// legacy-URL redirects; the account shell (Batch 9) owns /account/* and
// the /profile legacy-URL redirect.
const authedRoutes: RouteObject[] = protectedRoutes([
  ...dashboardRoutes,
  ...accountRoutes,
  ...adminRoutes,
  ...beneficiariesRoutes,
  ...transactionsRoutes,
  ...taxationRoutes,
  ...treasuryRoutes,
  ...budgetsRoutes,
  ...recurringRoutes,
  ...settingsRoutes,
]);

export const routes: RouteObject[] = [
  {
    element: <App />,
    // A thrown loader / failed lazy-chunk anywhere under the shell renders
    // the branded error surface instead of a blank screen.
    errorElement: <NotFoundPage />,
    children: [
      ...publicRoutes,
      ...authedRoutes,
      // Unknown paths render a branded 404 (inside the App shell, so the
      // TopNav stays put) rather than silently bouncing to the landing
      // page — a wrong URL should tell the user it's wrong, not quietly
      // dump them on the dashboard. Visitors with a stale token still
      // bounce to /login via the apiClient's 401 refresh chain or via
      // <ProtectedRoute> on any gated path. See shared/utils/sessionRedirect.ts.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
