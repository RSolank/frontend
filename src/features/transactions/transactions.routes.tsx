import { lazy } from 'react';
import { Navigate, useParams, type RouteObject } from 'react-router-dom';

// Lazy-load the list + statement upload chunks; the page versions of
// Add/Edit are still mounted on the legacy routes as redirects so
// existing deep-links (password-reset emails, copy-paste URLs) keep
// working. The actual UI lives in modals on the list page (Batch 6.5).
const TransactionsPage = lazy(() =>
  import('./pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
);
const UploadStatementPage = lazy(() =>
  import('./statement_upload/pages/UploadStatementPage').then((m) => ({
    default: m.UploadStatementPage,
  }))
);

// Tiny redirect helpers — preserve the legacy URL shape, but bounce
// the user to the canonical list-page modal entry point.
function AddRedirect() {
  return <Navigate to="/transactions?add=true" replace />;
}

function EditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/transactions?edit=${id ?? ''}`} replace />;
}

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes(...).
export const transactionsRoutes: RouteObject[] = [
  { path: '/transactions', element: <TransactionsPage /> },
  { path: '/add-transaction', element: <AddRedirect /> },
  { path: '/transactions/:id/edit', element: <EditRedirect /> },
  { path: '/upload-statement', element: <UploadStatementPage /> },
];
