import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { AccountLayout } from './components/AccountLayout';

// Account pages are lazy-chunked. Profile + Preferences both pull the
// metadata + countries-and-timezones graphs (via the metadata
// components), so isolating them keeps the initial bundle lean.
const AccountProfilePage = lazy(() =>
  import('./pages/AccountProfilePage').then((m) => ({
    default: m.AccountProfilePage,
  }))
);
const AccountSecurityPage = lazy(() =>
  import('./pages/AccountSecurityPage').then((m) => ({
    default: m.AccountSecurityPage,
  }))
);
const AccountPrivacyPage = lazy(() =>
  import('./pages/AccountPrivacyPage').then((m) => ({
    default: m.AccountPrivacyPage,
  }))
);
const AccountAccessibilityPage = lazy(() =>
  import('./pages/AccountAccessibilityPage').then((m) => ({
    default: m.AccountAccessibilityPage,
  }))
);
const AccountPreferencesPage = lazy(() =>
  import('./pages/AccountPreferencesPage').then((m) => ({
    default: m.AccountPreferencesPage,
  }))
);
const AccountNotificationsPage = lazy(() =>
  import('./pages/AccountNotificationsPage').then((m) => ({
    default: m.AccountNotificationsPage,
  }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes().
// Children inherit protection through the parent's gated <Outlet />.
//
// /profile is preserved as an alias to /account/profile so existing
// links + the legacy user-dropdown bookmark keep working without a
// 404.
export const accountRoutes: RouteObject[] = [
  {
    path: '/account',
    element: <AccountLayout />,
    children: [
      { index: true, element: <Navigate to="/account/profile" replace /> },
      { path: 'profile', element: <AccountProfilePage /> },
      { path: 'security', element: <AccountSecurityPage /> },
      { path: 'privacy', element: <AccountPrivacyPage /> },
      { path: 'accessibility', element: <AccountAccessibilityPage /> },
      { path: 'preferences', element: <AccountPreferencesPage /> },
      { path: 'notifications', element: <AccountNotificationsPage /> },
    ],
  },
  { path: '/profile', element: <Navigate to="/account/profile" replace /> },
];
