import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// The Dashboard is the authenticated home — three primary glance-cards
// (Transactions, Expense Tracker, Tax Tracker) plus secondary widgets
// on ≥lg. Lazy-loaded so the initial bundle doesn't pay for the
// cross-feature query hooks until the user actually visits /dashboard.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes(...).
export const dashboardRoutes: RouteObject[] = [
  { path: '/dashboard', element: <DashboardPage /> },
];
