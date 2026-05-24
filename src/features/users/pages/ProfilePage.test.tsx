import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { server } from '../../../test/server';

import { ProfilePage } from './ProfilePage';

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderProfile(children: ReactElement = <ProfilePage />) {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function resetStores() {
  useAuthStore.setState({
    user: null,
    constants: null,
    loading: false,
    error: null,
  });
  usePreferencesStore.getState().reset();
  localStorage.clear();
}

describe('ProfilePage', () => {
  beforeEach(() => {
    resetStores();
    server.use(
      http.get('http://localhost:4000/api/users/me', () =>
        HttpResponse.json({
          user: {
            user_id: 1,
            email_id: 'john@example.test',
            first_name: 'John',
            last_name: 'Doe',
            dob: '1990-01-01',
            contact: '+911234567890',
            country: 'India',
            currency: 'INR',
            timezone: 'Asia/Kolkata',
          },
        })
      )
    );
  });

  it('hydrates form from /api/users/me', async () => {
    renderProfile();
    await waitFor(() =>
      expect(screen.getByDisplayValue('John')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.test')).toBeInTheDocument();
  });

  it('PATCHes /api/users/me with the timezone and hydrates preferences post-save', async () => {
    let patchBody: unknown = null;
    server.use(
      http.patch(
        'http://localhost:4000/api/users/me',
        async ({ request }) => {
          patchBody = await request.json();
          return HttpResponse.json({ user: { user_id: 1 } });
        }
      ),
      http.get('http://localhost:4000/api/users/preferences', () =>
        HttpResponse.json({
          currency: 'USD',
          country: 'United States',
          timezone: 'America/New_York',
        })
      )
    );

    renderProfile();
    await waitFor(() =>
      expect(screen.getByDisplayValue('John')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/First name/), {
      target: { value: 'Jane' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      expect(patchBody).toMatchObject({
        first_name: 'Jane',
        last_name: 'Doe',
        timezone: 'Asia/Kolkata',
      });
    });

    // Post-save hydration: preferences store now reflects the
    // /preferences response (USD / America/New_York).
    await waitFor(() => {
      const prefs = usePreferencesStore.getState();
      expect(prefs.currency).toBe('USD');
      expect(prefs.timezone).toBe('America/New_York');
    });
  });

  it('validates the new password requirements', async () => {
    renderProfile();
    await waitFor(() =>
      expect(screen.getByDisplayValue('John')).toBeInTheDocument()
    );

    const newPassword = screen.getByLabelText(/New password/);
    const update = screen.getByRole('button', { name: 'Update password' });

    fireEvent.change(newPassword, { target: { value: 'short' } });
    expect(screen.getByText(/Password must have:/)).toBeInTheDocument();
    expect(update).toBeDisabled();

    fireEvent.change(newPassword, { target: { value: 'ValidPass123!' } });
    expect(update).not.toBeDisabled();
  });
});
