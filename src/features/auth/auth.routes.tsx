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
// BE Phase 2.7 (2FA) + 2.3 (new-device) — pending-token challenge
// landing pages. Same lazy-chunk treatment as the rest of the auth
// surface; both are reached via `navigate` from `useAuth.login`.
const VerifyTwoFactorPage = lazy(() =>
  import('./pages/VerifyTwoFactorPage').then((m) => ({
    default: m.VerifyTwoFactorPage,
  }))
);
const VerifyNewDevicePage = lazy(() =>
  import('./pages/VerifyNewDevicePage').then((m) => ({
    default: m.VerifyNewDevicePage,
  }))
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
  {
    path: '/verify/2fa',
    element: <VerifyTwoFactorPage />,
    errorElement: <AuthErrorFallback />,
  },
  {
    path: '/verify/new-device',
    element: <VerifyNewDevicePage />,
    errorElement: <AuthErrorFallback />,
  },
];
