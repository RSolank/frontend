import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// /recurring — inference-engine management page. The BE worker
// (BE Phase 1.5, `f369ce2`) detects recurring patterns from txn
// history and forecasts bills; this page lets the user confirm /
// edit / dismiss detected templates and author new ones by hand.
// Lazy so the new feature module doesn't punch the initial bundle.
const RecurringPage = lazy(() =>
  import('./pages/RecurringPage').then((m) => ({ default: m.RecurringPage }))
);

export const recurringRoutes: RouteObject[] = [
  { path: '/recurring', element: <RecurringPage /> },
];
