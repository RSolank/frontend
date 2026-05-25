import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy-load every page so the table machinery, form scaffolding, and
// statement-upload pipeline only ship when the user actually navigates
// there. Mirrors features/beneficiaries/beneficiaries.routes.tsx.
const TransactionsPage = lazy(() =>
  import('./pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
);
const AddTransactionPage = lazy(() =>
  import('./pages/AddTransactionPage').then((m) => ({
    default: m.AddTransactionPage,
  }))
);
const EditTransactionPage = lazy(() =>
  import('./pages/EditTransactionPage').then((m) => ({
    default: m.EditTransactionPage,
  }))
);
const UploadStatementPage = lazy(() =>
  import('./statement_upload/pages/UploadStatementPage').then((m) => ({
    default: m.UploadStatementPage,
  }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes(...).
export const transactionsRoutes: RouteObject[] = [
  { path: '/transactions', element: <TransactionsPage /> },
  { path: '/add-transaction', element: <AddTransactionPage /> },
  { path: '/transactions/:id/edit', element: <EditTransactionPage /> },
  { path: '/upload-statement', element: <UploadStatementPage /> },
];
