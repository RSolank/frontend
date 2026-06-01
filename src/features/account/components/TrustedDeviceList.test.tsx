import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { TrustedDeviceList } from './TrustedDeviceList';

const POPULATED_DEVICES = [
  {
    uid: 11,
    label:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    first_seen: '2026-05-01T12:00:00Z',
    last_seen: '2026-05-30T08:00:00Z',
    is_current: true,
  },
  {
    uid: 12,
    label:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E Safari/604.1',
    first_seen: '2026-04-01T12:00:00Z',
    last_seen: '2026-05-20T16:00:00Z',
    is_current: false,
  },
];

describe('<TrustedDeviceList>', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'test');
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
  });

  it('renders the empty state when no devices are trusted yet', async () => {
    renderWithProviders(<TrustedDeviceList />);
    await waitFor(() =>
      expect(
        screen.getByText(/No trusted devices yet/i)
      ).toBeInTheDocument()
    );
  });

  it('renders one row per device with This device label + Forget action', async () => {
    server.use(
      http.get(`${API_BASE}/auth/devices`, () =>
        HttpResponse.json(POPULATED_DEVICES)
      )
    );

    renderWithProviders(<TrustedDeviceList />);

    await waitFor(() =>
      expect(screen.getByTestId('trusted-device-list')).toBeInTheDocument()
    );

    const current = screen.getByTestId('trusted-device-row-11');
    expect(current).toHaveTextContent('Chrome on macOS');
    expect(within(current).getByText('This device')).toBeInTheDocument();

    const other = screen.getByTestId('trusted-device-row-12');
    expect(other).toHaveTextContent('Safari on iOS');
    expect(within(other).queryByText('This device')).not.toBeInTheDocument();
  });

  it('Forget action DELETEs the device + invalidates the query', async () => {
    let deletedUid: string | null = null;
    server.use(
      http.get(`${API_BASE}/auth/devices`, () =>
        HttpResponse.json(POPULATED_DEVICES)
      ),
      http.delete(
        `${API_BASE}/auth/devices/:uid`,
        ({ params }) => {
          deletedUid = params.uid as string;
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    renderWithProviders(<TrustedDeviceList />);
    await waitFor(() =>
      expect(screen.getByTestId('forget-device-12')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('forget-device-12'));
    const dialog = await screen.findByRole('dialog', {
      name: /Forget this trusted device/i,
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Forget/ }));

    await waitFor(() => expect(deletedUid).toBe('12'));
  });
});
