import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import { authRoutes } from '../features/auth/auth.routes';
import { beneficiariesRoutes } from '../features/beneficiaries/beneficiaries.routes';
import { categorizationRoutes } from '../features/categorization/categorization.routes';
import { tagsRoutes } from '../features/tags/tags.routes';
import { taxationRoutes } from '../features/taxation/taxation.routes';
import { transactionsRoutes } from '../features/transactions/transactions.routes';
import { usersRoutes } from '../features/users/users.routes';
import { BudgetsPage } from '../pages/budgets/BudgetsPage.jsx';
import { DashboardPage } from '../pages/Dashboard.jsx';
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
// Remaining legacy entries (Dashboard, Budgets, Settings) ship inline
// until their owning batch (8/8.5/9) extracts them.
const authedRoutes: RouteObject[] = protectedRoutes([
  { path: '/dashboard', element: <DashboardPage /> },
  ...usersRoutes,
  ...tagsRoutes,
  ...beneficiariesRoutes,
  ...transactionsRoutes,
  ...categorizationRoutes,
  ...taxationRoutes,
  { path: '/budgets', element: <BudgetsPage /> },
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
