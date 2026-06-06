import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AccountNotificationsPage } from './AccountNotificationsPage';

function primeUser() {
  act(() => {
    useAuthStore.getState().setUser({
      user_id: 1,
      email_id: 'user@example.test',
      role: 'user',
    });
    useAuthStore.getState().setLoading(false);
  });
}

describe('AccountNotificationsPage', () => {
  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('renders the editor with the user’s current disabled list', async () => {
    primeUser();
    server.use(
      http.get(`${API_BASE}/activity/signal-settings`, () =>
        HttpResponse.json({ disabled: ['bill_generated'] })
      )
    );

    renderWithProviders(<AccountNotificationsPage />);

    expect(
      await screen.findByLabelText(/Enable Bill Generated/)
    ).not.toBeChecked();
    expect(screen.getByLabelText(/Enable Budget Breached/)).toBeChecked();
  });

  it('toggling a kind PUTs to /activity/signal-settings with {kind, enabled}', async () => {
    primeUser();
    let body: unknown = null;
    server.use(
      http.put(`${API_BASE}/activity/signal-settings`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ disabled: ['bill_generated'] });
      })
    );

    renderWithProviders(<AccountNotificationsPage />);

    const billChk = await screen.findByLabelText(/Enable Bill Generated/);
    await userEvent.click(billChk);

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ kind: 'bill_generated', enabled: false });
  });

  it('renders the System off badge + disables the toggle for a system-disabled kind', async () => {
    primeUser();
    server.use(
      http.get(`${API_BASE}/activity/catalog`, () =>
        HttpResponse.json({
          entries: [
            {
              kind: 'deprecated_kind',
              event_class: 'notification',
              domain: 'auth',
              subject_type: 'session',
              priority: 3,
              rank_order: 500,
              system_enabled: false,
              collapse_threshold: null,
              collapse_label: null,
            },
          ],
        })
      )
    );

    renderWithProviders(<AccountNotificationsPage />);

    expect(await screen.findByText('System off')).toBeInTheDocument();
    expect(screen.getByLabelText(/Enable Deprecated Kind/)).toBeDisabled();
  });
});
