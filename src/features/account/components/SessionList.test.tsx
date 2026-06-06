import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { SessionList } from './SessionList';

// BE returns a bare `list[SessionInfo]` — wrapping in `{sessions: [...]}`
// here is the bug that masked the empty-Security-tab issue caught
// during E2E 2026-06-05.
const FIXTURE_SESSIONS = [
  {
    session_id: 1,
    ip_address: '203.0.113.5',
    device_data:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
    known_device_uid: 'uid-current',
    is_current: true,
    created_at: '2026-05-31T10:00:00Z',
    last_modified: '2026-06-01T08:15:00Z',
    expires_at: '2026-07-01T08:15:00Z',
  },
  {
    session_id: 2,
    ip_address: '198.51.100.42',
    device_data:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
    known_device_uid: 'uid-iphone',
    is_current: false,
    created_at: '2026-05-29T09:00:00Z',
    last_modified: '2026-05-30T19:30:00Z',
    expires_at: '2026-06-29T19:30:00Z',
  },
];

describe('SessionList', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renders one row per session with device label, IP, and "This device" badge on the current row', async () => {
    server.use(
      http.get(`${API_BASE}/auth/sessions`, () =>
        HttpResponse.json(FIXTURE_SESSIONS)
      )
    );

    renderWithProviders(<SessionList />);

    const current = await screen.findByTestId('session-row-1');
    expect(within(current).getByText(/Chrome on macOS/)).toBeInTheDocument();
    expect(within(current).getByText(/203\.0\.113\.5/)).toBeInTheDocument();
    expect(within(current).getByText(/This device/)).toBeInTheDocument();

    const other = screen.getByTestId('session-row-2');
    expect(within(other).getByText(/Safari on iOS/)).toBeInTheDocument();
    expect(within(other).getByText(/198\.51\.100\.42/)).toBeInTheDocument();
    expect(within(other).queryByText(/This device/)).not.toBeInTheDocument();
  });

  it('confirms before revoking a non-current session and removes the row on success', async () => {
    let deletedId: number | null = null;
    server.use(
      http.get(`${API_BASE}/auth/sessions`, () =>
        HttpResponse.json(FIXTURE_SESSIONS)
      ),
      http.delete(
        `${API_BASE}/auth/sessions/:sessionId`,
        ({ params }) => {
          deletedId = Number(params.sessionId);
          // Subsequent fetch returns the trimmed list.
          server.use(
            http.get(`${API_BASE}/auth/sessions`, () =>
              HttpResponse.json(
                FIXTURE_SESSIONS.filter((s) => s.session_id !== deletedId)
              )
            )
          );
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    renderWithProviders(<SessionList />);

    await screen.findByTestId('revoke-session-2');
    fireEvent.click(screen.getByTestId('revoke-session-2'));

    // Confirm dialog ("Revoke this session?") opens.
    expect(
      await screen.findByText('Revoke this session?')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(deletedId).toBe(2);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('session-row-2')).not.toBeInTheDocument();
    });
    // Current device row stays.
    expect(screen.getByTestId('session-row-1')).toBeInTheDocument();
  });

  it('uses the stronger "Revoke this device?" copy when the targeted row is is_current=true', async () => {
    server.use(
      http.get(`${API_BASE}/auth/sessions`, () =>
        HttpResponse.json(FIXTURE_SESSIONS)
      )
    );

    renderWithProviders(<SessionList />);

    await screen.findByTestId('revoke-session-1');
    fireEvent.click(screen.getByTestId('revoke-session-1'));

    expect(
      await screen.findByText('Revoke this device?')
    ).toBeInTheDocument();
  });

  it('renders an empty-state message when there are no sessions', async () => {
    // Default handler returns `[]`.
    renderWithProviders(<SessionList />);
    expect(
      await screen.findByText(/No active sessions/i)
    ).toBeInTheDocument();
  });
});
