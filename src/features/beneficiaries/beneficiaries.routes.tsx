import { lazy } from 'react';
import { Navigate, useParams, type RouteObject } from 'react-router-dom';

const BeneficiariesPage = lazy(() =>
  import('./pages/BeneficiariesPage').then((m) => ({
    default: m.BeneficiariesPage,
  }))
);

// Legacy detail route — preserved as a redirect into the list-page
// edit modal so any pre-Batch-6.5 bookmark / deep-link keeps working.
// The standalone BeneficiaryDetailPage was removed in the 2026-05-26
// follow-up; merge + edit + delete all live on the list now.
function DetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/beneficiaries?edit=${id ?? ''}`} replace />;
}

// Both paths are gated by <ProtectedRoute> via app/routes.tsx →
// protectedRoutes(...).
export const beneficiariesRoutes: RouteObject[] = [
  { path: '/beneficiaries', element: <BeneficiariesPage /> },
  { path: '/beneficiaries/:id', element: <DetailRedirect /> },
];
