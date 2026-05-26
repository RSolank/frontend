import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// The Tax Tracker page hosts the bills list + the current-week
// tracker. Heavy-ish (loads bill detail modal on demand) so it lazy-
// loads behind the existing /consumption-tax URL. The URL stays per
// Batch 6.5's "rename labels only" rule; a Batch 9 audit may rename
// it to /tax-tracker once the redirect cost is justified.
const TaxTrackerPage = lazy(() =>
  import('./pages/TaxTrackerPage').then((m) => ({
    default: m.TaxTrackerPage,
  }))
);

// Taxation rules live under /settings/taxation-rules per the
// Batch 7 → Batch 9 settings-shell plan. Batch 7 lands the URL now so
// Batch 9 doesn't need a redirect.
const TaxationRulesPage = lazy(() =>
  import('./pages/TaxationRulesPage').then((m) => ({
    default: m.TaxationRulesPage,
  }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes(...).
export const taxationRoutes: RouteObject[] = [
  { path: '/consumption-tax', element: <TaxTrackerPage /> },
  { path: '/settings/taxation-rules', element: <TaxationRulesPage /> },
];
