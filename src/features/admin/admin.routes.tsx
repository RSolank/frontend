import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

// Admin portal route group. Auth-gated by the parent
// `<ProtectedRoute>` (in `app/routes.tsx`); a second-line role gate
// runs inside `<AdminLandingPage>` via `useAdminGateQuery()` so a
// non-admin who guesses the URL gets the "Not available" panel.
const AdminLandingPage = lazy(() =>
  import('./pages/AdminLandingPage').then((m) => ({
    default: m.AdminLandingPage,
  }))
);

export const adminRoutes: RouteObject[] = [
  { path: '/admin', element: <AdminLandingPage /> },
  // Future tooling sub-routes hang off this; for now any deeper path
  // bounces back to the landing scaffold.
  { path: '/admin/*', element: <Navigate to="/admin" replace /> },
];
