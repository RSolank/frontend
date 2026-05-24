import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { BeneficiariesPage } from './pages/beneficiaries/BeneficiariesPage.jsx';
import { BeneficiaryDetailPage } from './pages/beneficiaries/BeneficiaryDetailPage.jsx';
import { BudgetsPage } from './pages/budgets/BudgetsPage.jsx';
import { DashboardPage } from './pages/Dashboard.jsx';
import { HomePage } from './pages/Home.jsx';
import { ConsumptionTaxPage } from './pages/tax/ConsumptionTaxPage.jsx';
import { AddTransactionPage } from './pages/transactions/AddTransaction.jsx';
import { EditTransactionPage } from './pages/transactions/EditTransaction.jsx';
import { TransactionsPage } from './pages/transactions/TransactionsPage.jsx';
import { UploadStatementPage } from './pages/transactions/UploadStatement.jsx';
import { LoginPage } from './pages/user/Login.jsx';
import { RegisterPage } from './pages/user/Register.jsx';
import { ProfilePage } from './pages/user/ProfilePage.jsx';
import { SettingsPage } from './pages/user/settings/SettingsPage.jsx';

// Moves to src/app/providers.tsx in Batch 1.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Transactions Routes */}
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-transaction"
        element={
          <ProtectedRoute>
            <AddTransactionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions/:id/edit"
        element={
          <ProtectedRoute>
            <EditTransactionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload-statement"
        element={
          <ProtectedRoute>
            <UploadStatementPage />
          </ProtectedRoute>
        }
      />

      {/* Dedicated Budget & Tax Pages */}
      <Route
        path="/budgets"
        element={
          <ProtectedRoute>
            <BudgetsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumption-tax"
        element={
          <ProtectedRoute>
            <ConsumptionTaxPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/beneficiaries"
        element={
          <ProtectedRoute>
            <BeneficiariesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/beneficiaries/:id"
        element={
          <ProtectedRoute>
            <BeneficiaryDetailPage />
          </ProtectedRoute>
        }
      />

      {/* User Settings */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
