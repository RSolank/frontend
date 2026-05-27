import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { server } from '../../../test/server';

import { AccountPreferencesPage } from './AccountPreferencesPage';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <AccountPreferencesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AccountPreferencesPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      constants: null,
      loading: false,
      error: null,
    });
    usePreferencesStore.getState().reset();
    localStorage.clear();
    server.use(
      http.get('http://localhost:4000/api/users/me', () =>
        HttpResponse.json({
          user: {
            user_id: 1,
            email_id: 'taylor@example.test',
            first_name: 'Taylor',
            last_name: 'Doe',
            country: 'India',
            currency: 'INR',
            timezone: 'Asia/Kolkata',
          },
        })
      )
    );
  });

  it('hydrates preferences from /api/users/me', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/Timezone/i)).toHaveValue('Asia/Kolkata')
    );
  });

  it('PATCHes only the preferences slice and re-hydrates the store', async () => {
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch('http://localhost:4000/api/users/me', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ user: { user_id: 1 } });
      }),
      http.get('http://localhost:4000/api/users/preferences', () =>
        HttpResponse.json({
          currency: 'USD',
          country: 'United States',
          timezone: 'America/New_York',
        })
      )
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/Timezone/i)).toHaveValue('Asia/Kolkata')
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      expect(patchBody).toMatchObject({
        country: 'India',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      });
      // Profile-page slice must NOT be in the payload — preferences
      // PATCHes only its own fields.
      expect(patchBody).not.toHaveProperty('first_name');
      expect(patchBody).not.toHaveProperty('last_name');
      expect(patchBody).not.toHaveProperty('contact');
    });

    // Hydrate side-effect: the preferences store now reflects the
    // /preferences response (USD / America/New_York) so the
    // x-user-currency / x-user-timezone headers update on the next
    // request.
    await waitFor(() => {
      const prefs = usePreferencesStore.getState();
      expect(prefs.currency).toBe('USD');
      expect(prefs.timezone).toBe('America/New_York');
    });
  });

  it('renders the Defaults card pointing at /account/accessibility', async () => {
    // Batch 9 polish: defaults (date format / number format / landing
    // route) now ship under /account/accessibility as frontend-only
    // Zustand stores, so this card no longer reads "Coming soon" —
    // it links to the Accessibility surface and notes cross-device
    // sync is still a backend follow-up.
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/Timezone/i)).toHaveValue('Asia/Kolkata')
    );
    expect(screen.getByRole('heading', { name: 'Defaults' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Accessibility' })
    ).toHaveAttribute('href', '/account/accessibility');
  });
});
