import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import { authRoutes } from '../features/auth/auth.routes';
import { beneficiariesRoutes } from '../features/beneficiaries/beneficiaries.routes';
import { budgetsRoutes } from '../features/budgets/budgets.routes';
import { categorizationRoutes } from '../features/categorization/categorization.routes';
import { dashboardRoutes } from '../features/dashboard/dashboard.routes';
import { tagsRoutes } from '../features/tags/tags.routes';
import { taxationRoutes } from '../features/taxation/taxation.routes';
import { transactionsRoutes } from '../features/transactions/transactions.routes';
import { usersRoutes } from '../features/users/users.routes';
import { HomePage } from '../pages/Home';
import { SettingsPage } from '../pages/user/settings/SettingsPage.jsx';

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
// this list without remembering to wrap each entry.
//
// Remaining legacy entry (Settings) ships inline until its owning
// Batch 9 extracts it into a feature module.
const authedRoutes: RouteObject[] = protectedRoutes([
  ...dashboardRoutes,
  ...usersRoutes,
  ...tagsRoutes,
  ...beneficiariesRoutes,
  ...transactionsRoutes,
  ...categorizationRoutes,
  ...taxationRoutes,
  ...budgetsRoutes,
  { path: '/settings', element: <SettingsPage /> },
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
