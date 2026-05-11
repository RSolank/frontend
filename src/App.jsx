import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/Home.jsx';
import { LoginPage } from './pages/user/Login.jsx';
import { RegisterPage } from './pages/user/Register.jsx';
import { ProfilePage } from './pages/user/ProfilePage.jsx';
import { DashboardPage } from './pages/Dashboard.jsx';
import { SettingsPage } from './pages/user/settings/SettingsPage.jsx';
import { TransactionsPage } from './pages/transactions/TransactionsPage.jsx';
import { AddTransactionPage } from './pages/transactions/AddTransaction.jsx';
import { EditTransactionPage } from './pages/transactions/EditTransaction.jsx';
import { UploadStatementPage } from './pages/transactions/UploadStatement.jsx';
import { BudgetsPage } from './pages/budgets/BudgetsPage.jsx';
import { ConsumptionTaxPage } from './pages/tax/ConsumptionTaxPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      } />
      
      {/* Transactions Routes */}
      <Route path="/transactions" element={
        <ProtectedRoute><TransactionsPage /></ProtectedRoute>
      } />
      <Route path="/add-transaction" element={
        <ProtectedRoute><AddTransactionPage /></ProtectedRoute>
      } />
      <Route path="/transactions/:id/edit" element={
        <ProtectedRoute><EditTransactionPage /></ProtectedRoute>
      } />
      <Route path="/upload-statement" element={
        <ProtectedRoute><UploadStatementPage /></ProtectedRoute>
      } />

      {/* Dedicated Budget & Tax Pages */}
      <Route path="/budgets" element={
        <ProtectedRoute><BudgetsPage /></ProtectedRoute>
      } />
      <Route path="/consumption-tax" element={
        <ProtectedRoute><ConsumptionTaxPage /></ProtectedRoute>
      } />

      {/* User Settings */}
      <Route path="/settings" element={
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
