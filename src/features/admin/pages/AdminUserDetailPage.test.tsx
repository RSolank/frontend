import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AdminUserDetailPage } from './AdminUserDetailPage';

// BE T-admin A3 (`4b6004e`) — pinning tests cover the gate, populated
// detail, 404 (not-found / SYSTEM / hard-purged), and the soft-deleted
// cemetery-status branch. The page reads ``useParams().userId`` so
// tests render it under a `Routes/Route` so the param resolves.

function primeAdmin(user: AuthUser | null) {
  act(() => {
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setLoading(false);
  });
}

const adminUser: AuthUser = {
  user_id: 1,
  email_id: 'admin@example.test',
  role: 'admin',
};

function renderDetail(userId = '11') {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
    </Routes>,
    { initialEntries: [`/admin/users/${userId}`] }
  );
}

const populatedDetail = {
  user_id: 11,
  email: 'jane@example.test',
  full_name: 'Jane Doe',
  role: 'user',
  registered_at: '2026-01-15T08:30:00Z',
  last_active_at: '2026-06-02T19:14:00Z',
  locked_until: null,
  deleted_at: null,
  disabled_at: null,
  two_factor_enabled: true,
  session_count: 2,
  country: 'India',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  recent_sessions: [
    {
      session_id: 'sess-1',
      ip_address: '203.0.113.5',
      device_summary: 'Chrome 130 / macOS',
      is_locked: false,
      created_at: '2026-06-01T08:00:00Z',
      expires_at: '2026-06-08T08:00:00Z',
    },
  ],
  recent_known_devices: [
    {
      device_uid: 17,
      fingerprint: 'abcdef0123456789aaaa',
      label: 'Work laptop',
      last_seen_at: '2026-06-02T19:14:00Z',
    },
  ],
  recent_activity: null,
  cemetery_status: null,
  stats: {
    joined_at: '2026-01-15T08:30:00Z',
    last_active_at: '2026-06-02T19:14:00Z',
    total_transactions: 42,
    total_budgets: 5,
    total_beneficiaries: 9,
    active_recurring: 3,
  },
};

describe('AdminUserDetailPage', () => {
  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('renders the "Not available" panel for non-admin users', () => {
    primeAdmin({
      user_id: 2,
      email_id: 'user@example.test',
      role: 'user',
    });

    renderDetail();

    expect(
      screen.getByRole('heading', { name: 'Not available' })
    ).toBeInTheDocument();
  });

  it('renders sections + status chip + stats for an admin', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json(populatedDetail)
      )
    );

    renderDetail('11');

    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' })
    ).toBeInTheDocument();
    // Email appears in both the header subtitle and the Identity
    // section's <dd>; assert the count instead of a single match.
    expect(screen.getAllByText('jane@example.test').length).toBeGreaterThan(0);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Asia/Kolkata')).toBeInTheDocument();
    // Stats block (the 42 transactions value).
    expect(screen.getByText('42')).toBeInTheDocument();
    // Session row visible.
    expect(screen.getByText('Chrome 130 / macOS')).toBeInTheDocument();
    expect(screen.getByText('Work laptop')).toBeInTheDocument();
  });

  it('hides the Activity section when recent_activity is null', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json(populatedDetail)
      )
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Jane Doe' });

    expect(
      screen.queryByRole('heading', { name: 'Recent activity' })
    ).not.toBeInTheDocument();
  });

  it('shows the Pending-deletion status when cemetery_status is populated', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json({
          ...populatedDetail,
          deleted_at: '2026-05-15T08:00:00Z',
          cemetery_status: {
            deleted_at: '2026-05-15T08:00:00Z',
            scheduled_purge_at: '2026-06-14T08:00:00Z',
          },
        })
      )
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Jane Doe' });

    expect(screen.getByText('Pending deletion')).toBeInTheDocument();
    // Scheduled-purge row is rendered only in the soft-deleted state.
    expect(screen.getByText('Scheduled purge')).toBeInTheDocument();
  });

  it('renders the not-found panel on 404 (default handler)', async () => {
    primeAdmin(adminUser);
    // Default MSW handler already returns 404; no override needed.

    renderDetail('999');

    expect(
      await screen.findByRole('heading', { name: 'User not found' })
    ).toBeInTheDocument();
  });

  it('renders the not-found panel for a non-numeric :userId', () => {
    primeAdmin(adminUser);

    renderDetail('not-a-number');

    expect(
      screen.getByRole('heading', { name: 'User not found' })
    ).toBeInTheDocument();
  });

  // T-admin B1 — lock/unlock action bar.

  it('shows Lock button for an active user and triggers PATCH /lock on confirm', async () => {
    primeAdmin(adminUser);
    let lockCalled = false;
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json(populatedDetail)
      ),
      http.patch(`${API_BASE}/admin/users/:id/lock`, async () => {
        lockCalled = true;
        return HttpResponse.json({
          user_id: 11,
          disabled_at: '2026-06-03T20:00:00Z',
        });
      })
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Jane Doe' });

    await userEvent.click(screen.getByRole('button', { name: /lock account/i }));
    // The dialog renders a second "Lock account" button as the confirm
    // — click the one inside the modal.
    const modalConfirm = await screen.findByRole('button', {
      name: 'Lock account',
    });
    await userEvent.click(modalConfirm);

    await waitFor(() => expect(lockCalled).toBe(true));
    await screen.findByText('Account locked.');
  });

  it('shows Unlock button for a disabled user and triggers PATCH /unlock', async () => {
    primeAdmin(adminUser);
    let unlockCalled = false;
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json({
          ...populatedDetail,
          disabled_at: '2026-06-01T08:00:00Z',
        })
      ),
      http.patch(`${API_BASE}/admin/users/:id/unlock`, async () => {
        unlockCalled = true;
        return HttpResponse.json({ user_id: 11, disabled_at: null });
      })
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Jane Doe' });

    await userEvent.click(screen.getByRole('button', { name: /unlock account/i }));
    const modalConfirm = await screen.findByRole('button', {
      name: 'Unlock account',
    });
    await userEvent.click(modalConfirm);

    await waitFor(() => expect(unlockCalled).toBe(true));
    await screen.findByText('Account unlocked.');
  });

  it('surfaces 409 on already-locked as a friendly error message', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json(populatedDetail)
      ),
      http.patch(`${API_BASE}/admin/users/:id/lock`, () =>
        HttpResponse.json({ detail: 'Account already disabled' }, { status: 409 })
      )
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Jane Doe' });
    await userEvent.click(screen.getByRole('button', { name: /lock account/i }));
    const modalConfirm = await screen.findByRole('button', {
      name: 'Lock account',
    });
    await userEvent.click(modalConfirm);

    expect(
      await screen.findByText('Account already disabled')
    ).toBeInTheDocument();
  });

  // T-admin B2 — force-logout action.

  it('Force logout button is disabled when session_count is 0', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json({
          ...populatedDetail,
          session_count: 0,
        })
      )
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Jane Doe' });

    expect(
      screen.getByRole('button', { name: /force logout all sessions/i })
    ).toBeDisabled();
  });

  it('Force-logout triggers DELETE /sessions and reports the terminated count', async () => {
    primeAdmin(adminUser);
    let deleteCalled = false;
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json(populatedDetail)
      ),
      http.delete(`${API_BASE}/admin/users/:id/sessions`, async () => {
        deleteCalled = true;
        return HttpResponse.json({ terminated: 3 });
      })
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Jane Doe' });

    await userEvent.click(
      screen.getByRole('button', { name: /force logout all sessions/i })
    );
    const modalConfirm = await screen.findByRole('button', {
      name: 'Force logout',
    });
    await userEvent.click(modalConfirm);

    await waitFor(() => expect(deleteCalled).toBe(true));
    await screen.findByText('Logged out 3 sessions.');
  });

  // T-admin E1 — admin signal-settings section on the user-detail page.

  it('renders the Signal settings section + toggles fire admin PUT', async () => {
    primeAdmin(adminUser);
    let putBody: unknown = null;
    server.use(
      http.get(`${API_BASE}/admin/users/:id`, () =>
        HttpResponse.json(populatedDetail)
      ),
      http.get(`${API_BASE}/admin/users/:id/signal-settings`, () =>
        HttpResponse.json({ disabled: [] })
      ),
      http.put(
        `${API_BASE}/admin/users/:id/signal-settings`,
        async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ disabled: ['bill_generated'] });
        }
      )
    );

    renderDetail('11');
    await screen.findByRole('heading', { name: 'Signal settings' });

    const billChk = await screen.findByLabelText(/Enable Bill Generated/);
    await userEvent.click(billChk);

    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toEqual({ kind: 'bill_generated', enabled: false });
  });
});
