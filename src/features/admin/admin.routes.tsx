import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

// Admin portal route group. Auth-gated by the parent
// `<ProtectedRoute>` (in `app/routes.tsx`); a second-line role gate
// runs inside each admin page via `useAdminGateQuery()` so a
// non-admin who guesses the URL gets the "Not available" panel.
// Every admin page is lazy-loaded so the table + infinite-query
// machinery stays out of the first-paint chunk.
const AdminLandingPage = lazy(() =>
  import('./pages/AdminLandingPage').then((m) => ({
    default: m.AdminLandingPage,
  }))
);
const AdminUsersPage = lazy(() =>
  import('./pages/AdminUsersPage').then((m) => ({
    default: m.AdminUsersPage,
  }))
);
const AdminUserDetailPage = lazy(() =>
  import('./pages/AdminUserDetailPage').then((m) => ({
    default: m.AdminUserDetailPage,
  }))
);
const AdminCemeteryPage = lazy(() =>
  import('./pages/AdminCemeteryPage').then((m) => ({
    default: m.AdminCemeteryPage,
  }))
);
const AdminCemeteryDetailPage = lazy(() =>
  import('./pages/AdminCemeteryDetailPage').then((m) => ({
    default: m.AdminCemeteryDetailPage,
  }))
);
const AdminBillBackfillPage = lazy(() =>
  import('./pages/AdminBillBackfillPage').then((m) => ({
    default: m.AdminBillBackfillPage,
  }))
);

export const adminRoutes: RouteObject[] = [
  { path: '/admin', element: <AdminLandingPage /> },
  // T-admin A2 — paginated user inventory.
  { path: '/admin/users', element: <AdminUsersPage /> },
  // T-admin A3 + B1/B2 — single-user detail with lock/unlock +
  // force-logout action bar. 404 surfaces in-page for a non-existent
  // / SYSTEM / hard-purged user_id.
  { path: '/admin/users/:userId', element: <AdminUserDetailPage /> },
  // T-admin C1 — cemetery audit (post-purge tombstones).
  { path: '/admin/cemetery', element: <AdminCemeteryPage /> },
  {
    path: '/admin/cemetery/:deletedUserId',
    element: <AdminCemeteryDetailPage />,
  },
  // T-admin D1 — bill-backfill ops form (FE-only; BE Phase 2.6 shipped
  // the endpoint).
  { path: '/admin/ops/bill-backfill', element: <AdminBillBackfillPage /> },
  // Future tooling sub-routes hang off this; for now any deeper path
  // bounces back to the landing scaffold.
  { path: '/admin/*', element: <Navigate to="/admin" replace /> },
];
