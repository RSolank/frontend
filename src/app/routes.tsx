import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import { authRoutes } from '../features/auth/auth.routes';
import { usersRoutes } from '../features/users/users.routes';
import { BeneficiariesPage } from '../pages/beneficiaries/BeneficiariesPage.jsx';
import { BeneficiaryDetailPage } from '../pages/beneficiaries/BeneficiaryDetailPage.jsx';
import { BudgetsPage } from '../pages/budgets/BudgetsPage.jsx';
import { DashboardPage } from '../pages/Dashboard.jsx';
import { HomePage } from '../pages/Home.jsx';
import { ConsumptionTaxPage } from '../pages/tax/ConsumptionTaxPage.jsx';
import { AddTransactionPage } from '../pages/transactions/AddTransaction.jsx';
import { EditTransactionPage } from '../pages/transactions/EditTransaction.jsx';
import { TransactionsPage } from '../pages/transactions/TransactionsPage.jsx';
import { UploadStatementPage } from '../pages/transactions/UploadStatement.jsx';
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
// Each feature batch (2–8) will eventually extract its slice into
// features/<feature>/<feature>.routes.tsx and import the array here.
// Until then, the legacy pages live inline.
const authedRoutes: RouteObject[] = protectedRoutes([
  { path: '/dashboard', element: <DashboardPage /> },
  ...usersRoutes,
  { path: '/transactions', element: <TransactionsPage /> },
  { path: '/add-transaction', element: <AddTransactionPage /> },
  { path: '/transactions/:id/edit', element: <EditTransactionPage /> },
  { path: '/upload-statement', element: <UploadStatementPage /> },
  { path: '/budgets', element: <BudgetsPage /> },
  { path: '/consumption-tax', element: <ConsumptionTaxPage /> },
  { path: '/beneficiaries', element: <BeneficiariesPage /> },
  { path: '/beneficiaries/:id', element: <BeneficiaryDetailPage /> },
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
