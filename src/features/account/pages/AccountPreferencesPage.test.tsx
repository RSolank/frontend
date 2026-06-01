import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
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
    // After BE Phase 1.9 `/api/users/me` returns identity only —
    // currency + timezone live on `/api/users/preferences`. The page
    // hydrates from both queries before first paint.
    server.use(
      http.get(`${API_BASE}/users/me`, () =>
        HttpResponse.json({
          user: {
            user_id: 1,
            email_id: 'taylor@example.test',
            first_name: 'Taylor',
            last_name: 'Doe',
            country: 'India',
          },
        })
      ),
      http.get(`${API_BASE}/users/preferences`, () =>
        HttpResponse.json({
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        })
      )
    );
  });

  it('hydrates the form from /api/users/me + /api/users/preferences', async () => {
    renderPage();
    await waitFor(() =>
      expect(
        (screen.getByRole('combobox', {
          name: 'Timezone',
        }) as HTMLInputElement).value
      ).toMatch(/^Asia\/Kolkata( \(UTC.*\))?$/)
    );
  });

  it('PATCHes /me (country) + /preferences (currency, timezone) in parallel and re-hydrates the store', async () => {
    let mePatchBody: Record<string, unknown> | null = null;
    let prefsPatchBody: Record<string, unknown> | null = null;
    // Track the server's current preferences view so the post-save
    // re-hydrate GET reflects the just-PATCHed values.
    const serverPrefs: { currency: string; timezone: string } = {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    };
    server.use(
      http.get(`${API_BASE}/users/preferences`, () =>
        HttpResponse.json({ ...serverPrefs })
      ),
      http.patch(`${API_BASE}/users/me`, async ({ request }) => {
        mePatchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ user: { user_id: 1 } });
      }),
      http.patch(
        `${API_BASE}/users/preferences`,
        async ({ request }) => {
          prefsPatchBody = (await request.json()) as Record<string, unknown>;
          // Server-side flip — the next GET sees the new values.
          serverPrefs.currency = 'USD';
          serverPrefs.timezone = 'America/New_York';
          return HttpResponse.json({ ...serverPrefs });
        }
      )
    );

    renderPage();
    await waitFor(() =>
      expect(
        (screen.getByRole('combobox', {
          name: 'Timezone',
        }) as HTMLInputElement).value
      ).toMatch(/^Asia\/Kolkata( \(UTC.*\))?$/)
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      // /me PATCH carries country only — no preferences fields.
      expect(mePatchBody).toMatchObject({ country: 'India' });
      expect(mePatchBody).not.toHaveProperty('currency');
      expect(mePatchBody).not.toHaveProperty('timezone');
      // /preferences PATCH carries the preferences slice — no /me fields.
      expect(prefsPatchBody).toMatchObject({
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      });
      expect(prefsPatchBody).not.toHaveProperty('country');
      expect(prefsPatchBody).not.toHaveProperty('first_name');
    });

    // Hydrate side-effect: the preferences store now reflects the
    // re-fetched /preferences response so every consumer of
    // `usePreferencesStore` reads the new currency + timezone.
    await waitFor(() => {
      const prefs = usePreferencesStore.getState();
      expect(prefs.currency).toBe('USD');
      expect(prefs.timezone).toBe('America/New_York');
    });
  });

  it('renders the Defaults card with the txn-kind control + pointer to /account/accessibility', async () => {
    // Batch 9.1: the Defaults card now hosts the
    // <DefaultTxnKindSelect /> (frontend-only Zustand persist) and
    // still points at /account/accessibility for the older page-only
    // stores (date / number / landing route).
    renderPage();
    await waitFor(() =>
      expect(
        (screen.getByRole('combobox', {
          name: 'Timezone',
        }) as HTMLInputElement).value
      ).toMatch(/^Asia\/Kolkata( \(UTC.*\))?$/)
    );
    expect(screen.getByText('Defaults')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Add transaction defaults to/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Accessibility' })
    ).toHaveAttribute('href', '/account/accessibility');
  });
});
