import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import { accountRoutes } from '../features/account/account.routes';
import { authRoutes } from '../features/auth/auth.routes';
import { beneficiariesRoutes } from '../features/beneficiaries/beneficiaries.routes';
import { budgetsRoutes } from '../features/budgets/budgets.routes';
import { dashboardRoutes } from '../features/dashboard/dashboard.routes';
import { settingsRoutes } from '../features/settings/settings.routes';
import { taxationRoutes } from '../features/taxation/taxation.routes';
import { transactionsRoutes } from '../features/transactions/transactions.routes';
import { HomePage } from '../pages/Home';

import { App } from './App';
import { protectedRoutes } from './routeHelpers';

// Public-facing routes (no auth gate). The auth feature owns /login and
// /register from Batch 2 onwards.
const publicRoutes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
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
  ...beneficiariesRoutes,
  ...transactionsRoutes,
  ...taxationRoutes,
  ...budgetsRoutes,
  ...settingsRoutes,
]);

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      ...publicRoutes,
      ...authedRoutes,
      // Unknown paths fall back to the landing page; visitors with a
      // stale token bounce to /login via the apiClient's 401 refresh
      // chain or via <ProtectedRoute> on any gated path they were
      // trying to reach. See shared/utils/sessionRedirect.ts.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
