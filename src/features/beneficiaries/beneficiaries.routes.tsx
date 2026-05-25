import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy-load both pages so the categorization-rules detail logic and
// alias-check graph stay out of the initial bundle. The Suspense
// fallback lives in src/app/providers.tsx.
const BeneficiariesPage = lazy(() =>
  import('./pages/BeneficiariesPage').then((m) => ({
    default: m.BeneficiariesPage,
  }))
);
const BeneficiaryDetailPage = lazy(() =>
  import('./pages/BeneficiaryDetailPage').then((m) => ({
    default: m.BeneficiaryDetailPage,
  }))
);

// Both paths are gated by <ProtectedRoute> via app/routes.tsx →
// protectedRoutes(...).
export const beneficiariesRoutes: RouteObject[] = [
  { path: '/beneficiaries', element: <BeneficiariesPage /> },
  { path: '/beneficiaries/:id', element: <BeneficiaryDetailPage /> },
];
