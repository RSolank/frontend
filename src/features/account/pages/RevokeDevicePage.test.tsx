import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { RevokeDevicePage } from './RevokeDevicePage';

describe('<RevokeDevicePage>', () => {
  it('shows the no-token info content when reached without ?token=', () => {
    renderWithProviders(<RevokeDevicePage />, {
      initialEntries: ['/account/revoke-device'],
    });
    expect(screen.getByText(/Revoke a device/i)).toBeInTheDocument();
    expect(
      screen.getByText(/one-click revoke link in the new-device/i)
    ).toBeInTheDocument();
  });

  it('auto-fires the POST and renders Success on 204', async () => {
    let seenBody: { token?: string } | null = null;
    server.use(
      http.post(
        'http://localhost:4000/api/auth/new-device/revoke',
        async ({ request }) => {
          seenBody = (await request.json()) as { token: string };
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    renderWithProviders(<RevokeDevicePage />, {
      initialEntries: ['/account/revoke-device?token=opaque-1'],
    });

    await waitFor(() =>
      expect(screen.getByText(/Device revoked/i)).toBeInTheDocument()
    );
    expect(seenBody).toEqual({ token: 'opaque-1' });
  });

  it('renders the Invalid panel on 400', async () => {
    server.use(
      http.post('http://localhost:4000/api/auth/new-device/revoke', () =>
        HttpResponse.json({ detail: 'bad' }, { status: 400 })
      )
    );

    renderWithProviders(<RevokeDevicePage />, {
      initialEntries: ['/account/revoke-device?token=stale-1'],
    });

    await waitFor(() =>
      expect(screen.getByText(/Link expired or invalid/i)).toBeInTheDocument()
    );
  });
});
