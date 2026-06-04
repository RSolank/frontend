import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { renderWithProviders } from '../../../test/renderWithProviders';

import { AdminLandingPage } from './AdminLandingPage';

// BE T-admin A1 (`2c47fa9`, FE Platform Batch 18) — the gate is a sync
// store read, not an MSW-mocked `/admin/ping`. Tests set
// `useAuthStore` directly before rendering.

function primeStore(user: AuthUser | null, loading = false) {
  act(() => {
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setLoading(loading);
  });
}

describe('AdminLandingPage', () => {
  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('renders the admin scaffold when the user has role=admin', () => {
    primeStore({
      user_id: 1,
      email_id: 'admin@example.test',
      role: 'admin',
    });

    renderWithProviders(<AdminLandingPage />);

    expect(
      screen.getByRole('heading', { name: 'Admin tools' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Access gate \(live\)/)).toBeInTheDocument();
    expect(screen.getByText(/role: "admin"/)).toBeInTheDocument();
  });

  it('renders the "Not available" panel for a non-admin user', () => {
    primeStore({
      user_id: 2,
      email_id: 'user@example.test',
      role: 'user',
    });

    renderWithProviders(<AdminLandingPage />);

    expect(
      screen.getByRole('heading', { name: 'Not available' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Admin tools' })
    ).not.toBeInTheDocument();
  });

  it('shows the loading state while the boot hydration is in flight', () => {
    primeStore(null, true);

    renderWithProviders(<AdminLandingPage />);

    expect(screen.getByText(/Checking access…/)).toBeInTheDocument();
  });
});
