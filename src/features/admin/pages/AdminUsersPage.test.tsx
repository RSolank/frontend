import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AdminUsersPage } from './AdminUsersPage';

// BE T-admin A2 (`2f21ff7`) wire — tests cover the gate (admin vs
// non-admin), populated table, search debounce + ≤2-char skip,
// include_deleted toggle, pagination "Load more", and the
// zero-results empty state.

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

const page1 = {
  users: [
    {
      user_id: 11,
      email: 'alice@example.test',
      full_name: 'Alice Adams',
      role: 'user',
      registered_at: '2026-01-15T08:30:00Z',
      last_active_at: '2026-06-02T12:00:00Z',
      locked_until: null,
      deleted_at: null,
      disabled_at: null,
      two_factor_enabled: true,
      session_count: 2,
    },
    {
      user_id: 12,
      email: 'bob@example.test',
      full_name: 'Bob Brown',
      role: 'user',
      registered_at: '2026-02-10T08:30:00Z',
      last_active_at: null,
      locked_until: '9999-12-31T23:59:59',
      deleted_at: null,
      disabled_at: null,
      two_factor_enabled: false,
      session_count: 0,
    },
  ],
  next_cursor: 'cursor-page-2',
  has_more: true,
};

describe('AdminUsersPage', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_BASE}/admin/users`, () => HttpResponse.json(page1))
    );
  });

  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('renders the "Not available" panel for non-admin users', () => {
    primeAdmin({
      user_id: 2,
      email_id: 'user@example.test',
      role: 'user',
    });

    renderWithProviders(<AdminUsersPage />);

    expect(
      screen.getByRole('heading', { name: 'Not available' })
    ).toBeInTheDocument();
    // Inventory must not render for non-admins.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the user inventory with status chips for an admin', async () => {
    primeAdmin(adminUser);

    renderWithProviders(<AdminUsersPage />);

    expect(
      await screen.findByRole('link', { name: 'alice@example.test' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'bob@example.test' })
    ).toBeInTheDocument();
    // Status chips: alice active, bob locked.
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('row links point at /admin/users/:id', async () => {
    primeAdmin(adminUser);
    renderWithProviders(<AdminUsersPage />);

    const link = await screen.findByRole('link', { name: 'alice@example.test' });
    expect(link).toHaveAttribute('href', '/admin/users/11');
  });

  it('shows "Load more" when has_more=true and appends the next page', async () => {
    primeAdmin(adminUser);
    const page2 = {
      users: [
        {
          user_id: 13,
          email: 'carol@example.test',
          full_name: 'Carol Choi',
          role: 'user',
          registered_at: '2026-03-01T08:30:00Z',
          last_active_at: null,
          locked_until: null,
          deleted_at: null,
          disabled_at: null,
          two_factor_enabled: false,
          session_count: 1,
        },
      ],
      next_cursor: null,
      has_more: false,
    };
    server.use(
      http.get(`${API_BASE}/admin/users`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('cursor') === 'cursor-page-2') {
          return HttpResponse.json(page2);
        }
        return HttpResponse.json(page1);
      })
    );

    renderWithProviders(<AdminUsersPage />);
    await screen.findByRole('link', { name: 'alice@example.test' });

    const loadMore = screen.getByRole('button', { name: /load more/i });
    await userEvent.click(loadMore);

    expect(
      await screen.findByRole('link', { name: 'carol@example.test' })
    ).toBeInTheDocument();
    // Once exhausted, the button is gone.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /load more/i })
      ).not.toBeInTheDocument()
    );
  });

  it('search input fires a request only after debounce + 3-char threshold', async () => {
    primeAdmin(adminUser);

    const recorded: Array<URLSearchParams> = [];
    server.use(
      http.get(`${API_BASE}/admin/users`, ({ request }) => {
        recorded.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          users: [],
          next_cursor: null,
          has_more: false,
        });
      })
    );

    renderWithProviders(<AdminUsersPage />);
    // Initial fetch (q empty).
    await waitFor(() => expect(recorded.length).toBeGreaterThan(0));
    const initialCount = recorded.length;

    const search = screen.getByRole('searchbox');
    await userEvent.type(search, 'ab');
    // <=2 chars: still treated as empty q; no new fetch should fire
    // beyond debounce settling on the same key.
    await waitFor(
      () => {
        // Allow ~400ms (300ms debounce + slack).
        expect(recorded.length).toBe(initialCount);
      },
      { timeout: 600 }
    );

    await userEvent.type(search, 'c');
    await waitFor(() => {
      const last = recorded[recorded.length - 1];
      expect(last?.get('q')).toBe('abc');
    });
  });

  it('toggling Include soft-deleted re-fetches with include_deleted=true', async () => {
    primeAdmin(adminUser);

    const recorded: Array<URLSearchParams> = [];
    server.use(
      http.get(`${API_BASE}/admin/users`, ({ request }) => {
        recorded.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          users: [],
          next_cursor: null,
          has_more: false,
        });
      })
    );

    renderWithProviders(<AdminUsersPage />);
    await waitFor(() => expect(recorded.length).toBeGreaterThan(0));

    await userEvent.click(screen.getByLabelText(/include soft-deleted/i));

    await waitFor(() => {
      const last = recorded[recorded.length - 1];
      expect(last?.get('include_deleted')).toBe('true');
    });
  });

  it('renders an empty-state row when the inventory is empty', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/users`, () =>
        HttpResponse.json({ users: [], next_cursor: null, has_more: false })
      )
    );

    renderWithProviders(<AdminUsersPage />);

    expect(
      await screen.findByText('No users to show.')
    ).toBeInTheDocument();
  });
});
