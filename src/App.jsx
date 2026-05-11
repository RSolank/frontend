import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/Home.jsx';
import { LoginPage } from './pages/Login.jsx';
import { RegisterPage } from './pages/Register.jsx';
import { DashboardPage } from './pages/Dashboard.jsx';
import { AddTransactionPage } from './pages/AddTransaction.jsx';
import { EditTransactionPage } from './pages/EditTransaction.jsx';
import { UploadStatementPage } from './pages/UploadStatement.jsx';
import { SettingsPage } from './pages/Settings.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

function App() {
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

