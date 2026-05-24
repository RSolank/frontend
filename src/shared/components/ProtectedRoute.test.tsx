import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import * as AuthContextModule from '../../state/AuthContext.jsx';

import { ProtectedRoute } from './ProtectedRoute';

// useAuth comes from .jsx and has no TS signature yet; cast each
// mockReturnValue. Batch 2 types AuthContext and drops the cast.
const mockAuth = (value: { user: unknown; loading: boolean }) =>
  vi
    .spyOn(AuthContextModule, 'useAuth')
    .mockReturnValue(value as never);

describe('ProtectedRoute', () => {
  it('redirects to login when user is unauthenticated', () => {
    mockAuth({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
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

    expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument();
  });

  it('allows access to protected content when authenticated', () => {
    mockAuth({
      user: { user_id: 1, email_id: 'test@example.com' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
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

    expect(screen.getByText('Secret Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Page Mock')).not.toBeInTheDocument();
  });

  it('shows loading indicator when auth is verifying', () => {
    mockAuth({ user: null, loading: true });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
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

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
