import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// `/budgets` URL preserved per Batch 6.5's "labels rename, URLs stay"
// rule. Nav label is "Expense Tracker"; the route URL stays so deep
// links + bookmarks survive. A Batch 9 audit will consider a rename
// to `/expense-tracker`.
const ExpenseTrackerPage = lazy(() =>
  import('./pages/ExpenseTrackerPage').then((m) => ({
    default: m.ExpenseTrackerPage,
  }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes(...).
export const budgetsRoutes: RouteObject[] = [
  { path: '/budgets', element: <ExpenseTrackerPage /> },
];
