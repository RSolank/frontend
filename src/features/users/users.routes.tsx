import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy-load the Profile page so the `countries-and-timezones` graph
// (pulled in by TimezoneSelect) ships in a separate chunk instead of the
// initial-paint bundle. Mirrors features/auth/auth.routes.tsx. The
// Suspense fallback comes from src/app/providers.tsx.
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);

// The /profile route still needs the <ProtectedRoute> wrap — that's
// applied by routes.tsx via protectedRoutes(), so we just export the
// raw RouteObject here.
export const usersRoutes: RouteObject[] = [
  { path: '/profile', element: <ProfilePage /> },
];
