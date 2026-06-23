import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// User-facing label is "Savings" (the TopNav link); the URL + feature dir
// stay `treasury` — the infra name on the taxation → savings → investments
// spine. Lazy so the page + its chart primitives stay out of first-paint.
const SavingsPage = lazy(() =>
  import('./pages/SavingsPage').then((m) => ({ default: m.SavingsPage }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes(...).
export const treasuryRoutes: RouteObject[] = [
  { path: '/treasury', element: <SavingsPage /> },
];
