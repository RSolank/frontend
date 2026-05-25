import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import { authRoutes } from '../features/auth/auth.routes';
import { beneficiariesRoutes } from '../features/beneficiaries/beneficiaries.routes';
import { tagsRoutes } from '../features/tags/tags.routes';
import { transactionsRoutes } from '../features/transactions/transactions.routes';
import { usersRoutes } from '../features/users/users.routes';
import { BudgetsPage } from '../pages/budgets/BudgetsPage.jsx';
import { DashboardPage } from '../pages/Dashboard.jsx';
import { HomePage } from '../pages/Home.jsx';
import { ConsumptionTaxPage } from '../pages/tax/ConsumptionTaxPage.jsx';
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
// Remaining legacy entries (Dashboard, Budgets, ConsumptionTax,
// Settings) ship inline until their owning batch (6/7/8/9) extracts
// them.
const authedRoutes: RouteObject[] = protectedRoutes([
  { path: '/dashboard', element: <DashboardPage /> },
  ...usersRoutes,
  ...tagsRoutes,
  ...beneficiariesRoutes,
  ...transactionsRoutes,
  { path: '/budgets', element: <BudgetsPage /> },
  { path: '/consumption-tax', element: <ConsumptionTaxPage /> },
  { path: '/settings', element: <SettingsPage /> },
]);

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      ...publicRoutes,
      ...authedRoutes,
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
