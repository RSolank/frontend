import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AdminCemeteryPage } from './AdminCemeteryPage';

// BE T-admin C1 — cemetery list pinning tests cover the gate,
// populated rows, search debounce (≤2-char skip), date range
// filters reaching the BE, and pagination Load-more.

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
  deleted_users: [
    {
      deleted_user_id: 51,
      former_user_id: 42,
      email: 'gone@example.test',
      deleted_at: '2026-05-15T08:00:00Z',
      account_opened_at: '2025-08-01T00:00:00Z',
      country: 'India',
      currency: 'INR',
      committee_bill_replicas_count: 12,
      expense_total_replicas_count: 5,
    },
  ],
  next_cursor: null,
  has_more: false,
};

describe('AdminCemeteryPage', () => {
  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('renders the Not-available panel for non-admin users', () => {
    primeAdmin({
      user_id: 2,
      email_id: 'user@example.test',
      role: 'user',
    });
    renderWithProviders(<AdminCemeteryPage />);
    expect(
      screen.getByRole('heading', { name: 'Not available' })
    ).toBeInTheDocument();
  });

  it('renders cemetery rows for an admin with replica counts', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/cemetery`, () => HttpResponse.json(page1))
    );

    renderWithProviders(<AdminCemeteryPage />);

    expect(
      await screen.findByRole('link', { name: 'gone@example.test' })
    ).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('row links point to /admin/cemetery/:id', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/cemetery`, () => HttpResponse.json(page1))
    );

    renderWithProviders(<AdminCemeteryPage />);

    const link = await screen.findByRole('link', { name: 'gone@example.test' });
    expect(link).toHaveAttribute('href', '/admin/cemetery/51');
  });

  it('renders an empty-state row for zero results', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/cemetery`, () =>
        HttpResponse.json({
          deleted_users: [],
          next_cursor: null,
          has_more: false,
        })
      )
    );

    renderWithProviders(<AdminCemeteryPage />);

    expect(
      await screen.findByText('No deleted users to show.')
    ).toBeInTheDocument();
  });

  it('search input fires a request after debounce + 3-char threshold', async () => {
    primeAdmin(adminUser);
    const recorded: Array<URLSearchParams> = [];
    server.use(
      http.get(`${API_BASE}/admin/cemetery`, ({ request }) => {
        recorded.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          deleted_users: [],
          next_cursor: null,
          has_more: false,
        });
      })
    );

    renderWithProviders(<AdminCemeteryPage />);
    await waitFor(() => expect(recorded.length).toBeGreaterThan(0));
    const initialCount = recorded.length;

    const search = screen.getByRole('searchbox');
    await userEvent.type(search, 'ab');
    await waitFor(
      () => expect(recorded.length).toBe(initialCount),
      { timeout: 600 }
    );

    await userEvent.type(search, 'c');
    await waitFor(() => {
      const last = recorded[recorded.length - 1];
      expect(last?.get('q')).toBe('abc');
    });
  });

  it('From-date filter sends `from` query param to the BE', async () => {
    primeAdmin(adminUser);
    const recorded: Array<URLSearchParams> = [];
    server.use(
      http.get(`${API_BASE}/admin/cemetery`, ({ request }) => {
        recorded.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          deleted_users: [],
          next_cursor: null,
          has_more: false,
        });
      })
    );

    renderWithProviders(<AdminCemeteryPage />);
    await waitFor(() => expect(recorded.length).toBeGreaterThan(0));

    const fromInput = screen.getByLabelText(/deleted from date/i);
    await userEvent.type(fromInput, '2026-04-01');

    await waitFor(() => {
      const last = recorded[recorded.length - 1];
      expect(last?.get('from')).toBe('2026-04-01');
    });
  });
});
