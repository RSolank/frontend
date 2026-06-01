import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { server } from '../../../test/server';

import { LoginPage } from './LoginPage';

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function resetStores() {
  useAuthStore.setState({
    user: null,
    constants: null,
    loading: false,
    error: null,
    retryAfterSeconds: null,
  });
  usePreferencesStore.getState().reset();
  localStorage.clear();
}

describe('LoginPage', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renders login form when unauthenticated', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Login', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
  });

  it('renders loading state when boot is still hydrating', () => {
    useAuthStore.setState({ loading: true });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('renders Navigate redirect when already authenticated', () => {
    useAuthStore.setState({
      user: { user_id: 1, email_id: 'a@b.test' },
      loading: false,
    });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );
    // After Navigate, the login h1 should no longer be in the DOM.
    expect(screen.queryByText('Login', { selector: 'h1' })).toBeNull();
  });

  it('submits credentials and hydrates auth + preferences', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'fixture@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'SecurePass123!' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    });

    await waitFor(() => {
      // After login the access token has been persisted by the apiClient.
      expect(localStorage.getItem('access_token')).toBe('msw-access');
    });
    // useLoginMutation.onSuccess hydrated preferences from MSW handler.
    await waitFor(() => {
      expect(usePreferencesStore.getState().currency).toBe('INR');
      expect(usePreferencesStore.getState().timezone).toBe('Asia/Kolkata');
    });
  });

  it('renders the rate-limit inline countdown when /login returns 429 + Retry-After', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          { detail: 'Too many attempts' },
          { status: 429, headers: { 'Retry-After': '120' } }
        )
      )
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'fixture@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'SecurePass123!' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    });

    const notice = await screen.findByTestId('auth-rate-limit');
    // Sub-hour values are rounded up to whole minutes — 120s → "in 2 minutes".
    expect(notice).toHaveTextContent(/Too many login attempts/);
    expect(notice).toHaveTextContent(/in 2 minutes/);
    expect(useAuthStore.getState().retryAfterSeconds).toBe(120);
  });

  it('surfaces the device-block countdown when /login returns 403 + Retry-After', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          { detail: 'Device blocked' },
          { status: 403, headers: { 'Retry-After': '45' } }
        )
      )
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'fixture@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'SecurePass123!' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    });

    const notice = await screen.findByTestId('auth-rate-limit');
    expect(notice).toHaveTextContent(/in 45 seconds/);
  });

  it('exposes the forgot-password flow', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Forgot password?'));
    // RecoveryFlow's first step renders the "Registered email" input —
    // page-title cycling no longer happens because the recovery state
    // lives inside <LoginForm /> rather than the page wrapper.
    expect(screen.getByLabelText(/Registered email/)).toBeInTheDocument();
  });
});
