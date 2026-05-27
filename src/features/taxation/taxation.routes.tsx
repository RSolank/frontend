import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// The Tax Tracker page hosts the bills list + the current-week
// tracker. Heavy-ish (loads bill detail modal on demand) so it lazy-
// loads behind the existing /consumption-tax URL. The URL stays per
// Batch 6.5's "rename labels only" rule; a Batch 10 audit may rename
// it to /tax-tracker once the redirect cost is justified.
const TaxTrackerPage = lazy(() =>
  import('./pages/TaxTrackerPage').then((m) => ({
    default: m.TaxTrackerPage,
  }))
);

// /settings/taxation-rules is mounted by the Batch 9 settings shell
// (features/settings/settings.routes.tsx) which imports
// TaxationRulesPage directly. The taxation feature only exposes its
// own top-level route here.
export const taxationRoutes: RouteObject[] = [
  { path: '/consumption-tax', element: <TaxTrackerPage /> },
];
