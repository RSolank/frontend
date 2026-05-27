import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { SettingsLayout } from './components/SettingsLayout';

// Pages live in their owning feature module (tags / categorization /
// taxation). The settings shell just composes them under a single
// /settings/* URL space with shared sidebar + breadcrumb chrome.
const TagsPage = lazy(() =>
  import('../tags/pages/TagsPage').then((m) => ({ default: m.TagsPage }))
);

const CategorizationRulesPage = lazy(() =>
  import('../categorization/pages/CategorizationRulesPage').then((m) => ({
    default: m.CategorizationRulesPage,
  }))
);

const TaxationRulesPage = lazy(() =>
  import('../taxation/pages/TaxationRulesPage').then((m) => ({
    default: m.TaxationRulesPage,
  }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes().
// Children inherit protection through the parent's gated <Outlet />.
//
// No legacy /categories or /categorization-rules redirects: those URLs
// were only ever interim (Batches 4 and 6) and no in-app surface links
// to them — the TopNav SETTINGS dropdown + mobile drawer + the husk
// SettingsPage all migrated to /settings/* in this batch, and a
// repo-wide grep finds zero references to the old paths. Any external
// bookmark falls through to the `*` catch-all (→ `/` or `/login` via
// `<ProtectedRoute>`); that's the same UX the app gives for every
// other unknown URL.
export const settingsRoutes: RouteObject[] = [
  {
    path: '/settings',
    element: <SettingsLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/settings/categories" replace />,
      },
      { path: 'categories', element: <TagsPage /> },
      { path: 'categorization-rules', element: <CategorizationRulesPage /> },
      { path: 'taxation-rules', element: <TaxationRulesPage /> },
    ],
  },
];
