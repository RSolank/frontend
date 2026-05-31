import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { server } from '../../../test/server';

import { AccountSecurityPage } from './AccountSecurityPage';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <AccountSecurityPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AccountSecurityPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      constants: null,
      loading: false,
      error: null,
    });
    localStorage.clear();
    server.use(
      http.get('http://localhost:4000/api/auth/recovery', () =>
        HttpResponse.json({
          questions: [{ question: 'What was the name of your first pet?' }],
        })
      )
    );
  });

  it('disables the password Update button until the password is valid', async () => {
    renderPage();
    const update = screen.getByRole('button', { name: 'Update password' });
    const newPwd = screen.getByLabelText(/New password/i);

    fireEvent.change(newPwd, { target: { value: 'short' } });
    expect(update).toBeDisabled();
    expect(screen.getByText(/Password must have:/)).toBeInTheDocument();

    fireEvent.change(newPwd, { target: { value: 'ValidPass123!' } });
    expect(update).not.toBeDisabled();
  });

  it('shows the current security question fetched from /api/auth/recovery', async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText('What was the name of your first pet?')
      ).toBeInTheDocument()
    );
  });

  it('renders the active-sessions card backed by /api/auth/sessions', async () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Active sessions' })
    ).toBeInTheDocument();
    // Default MSW handler returns an empty session list — the
    // SessionList renders the empty state inline.
    await waitFor(() =>
      expect(screen.getByText(/No active sessions/i)).toBeInTheDocument()
    );
  });
});
