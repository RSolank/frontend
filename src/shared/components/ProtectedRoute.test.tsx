import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../state/auth.store';

import { ProtectedRoute } from './ProtectedRoute';

function setAuth(value: { user: unknown; loading: boolean }) {
  useAuthStore.setState({
    user: value.user as never,
    loading: value.loading,
    constants: null,
    error: null,
  });
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/" element={<div>Landing</div>} />
        <Route path="/login" element={<div>Login Page Mock</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Secret Dashboard</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    setAuth({ user: null, loading: false });
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  });
  afterEach(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  });

  it('redirects to landing when unauthenticated and no tokens are present', () => {
    renderProtected();
    expect(screen.getByText('Landing')).toBeInTheDocument();
    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument();
  });

  it('redirects to login when unauthenticated but refresh_token is present (session expired)', () => {
    localStorage.setItem('refresh_token', 'stale-token');
    renderProtected();
    expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument();
  });

  it('allows access to protected content when authenticated', () => {
    setAuth({
      user: { user_id: 1, email_id: 'test@example.com' },
      loading: false,
    });
    renderProtected();
    expect(screen.getByText('Secret Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Page Mock')).not.toBeInTheDocument();
  });

  it('shows loading indicator when auth is verifying', () => {
    setAuth({ user: null, loading: true });
    renderProtected();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
