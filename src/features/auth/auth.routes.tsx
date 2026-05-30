import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

import { AuthErrorFallback } from './components/AuthErrorFallback';

// Lazy-load the auth pages so `countries-and-timezones` (~30 KB gz used
// by the Register form's TimezoneSelect) ships in a separate chunk
// instead of the initial-paint bundle. The Suspense fallback comes
// from src/app/providers.tsx (it already wraps RouterProvider).
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);

// Per-feature route module — composed by src/app/routes.tsx. Each route
// carries its own `errorElement` so a thrown render error (e.g. inside
// the recovery flow) surfaces a feature-scoped fallback instead of the
// global ErrorBoundary.
export const authRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <AuthErrorFallback />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
    errorElement: <AuthErrorFallback />,
  },
];
