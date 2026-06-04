import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AdminBillBackfillPage } from './AdminBillBackfillPage';

// T-admin D1 — bill-backfill form. Tests cover the gate, picker
// selection, validation (range, future end, range cap), confirm
// dialog flow, success log append, and error surfacing.

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

const targetUser = {
  user_id: 42,
  email: 'jane@example.test',
  full_name: 'Jane Doe',
  role: 'user',
  registered_at: '2026-01-15T08:30:00Z',
  last_active_at: null,
  locked_until: null,
  deleted_at: null,
  disabled_at: null,
  two_factor_enabled: false,
  session_count: 0,
};

describe('AdminBillBackfillPage', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_BASE}/admin/users`, ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('q') ?? '';
        if (q.includes('jane') || q.includes('Jane')) {
          return HttpResponse.json({
            users: [targetUser],
            next_cursor: null,
            has_more: false,
          });
        }
        return HttpResponse.json({
          users: [],
          next_cursor: null,
          has_more: false,
        });
      })
    );
  });

  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('renders the Not-available panel for non-admin users', () => {
    primeAdmin({ user_id: 2, email_id: 'user@example.test', role: 'user' });
    renderWithProviders(<AdminBillBackfillPage />);
    expect(
      screen.getByRole('heading', { name: 'Not available' })
    ).toBeInTheDocument();
  });

  it('disables the Generate button until a user + valid range are chosen', async () => {
    primeAdmin(adminUser);
    renderWithProviders(<AdminBillBackfillPage />);

    const generate = screen.getByRole('button', { name: 'Generate bills' });
    expect(generate).toBeDisabled();

    // Pick a user via typeahead.
    const search = screen.getByRole('searchbox', {
      name: /search target user by email or name/i,
    });
    await userEvent.type(search, 'jane');
    const option = await screen.findByRole('option', { name: /Jane Doe/i });
    await userEvent.click(option);
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();

    // Range still empty -> button still disabled.
    expect(generate).toBeDisabled();
  });

  it('rejects an end date that is today or later', async () => {
    primeAdmin(adminUser);
    renderWithProviders(<AdminBillBackfillPage />);

    // Pick the user.
    const search = screen.getByRole('searchbox', {
      name: /search target user by email or name/i,
    });
    await userEvent.type(search, 'jane');
    await userEvent.click(
      await screen.findByRole('option', { name: /Jane Doe/i })
    );

    // Type a valid start and a far-future end (e.g. 2099).
    const startInput = screen.getByLabelText('Period start');
    const endInput = screen.getByLabelText('Period end');
    await userEvent.type(startInput, '2026-04-01');
    await userEvent.type(endInput, '2099-04-08');

    expect(
      await screen.findByText(/Period end must be earlier than today/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate bills' })).toBeDisabled();
  });

  it('rejects ranges over 365 days', async () => {
    primeAdmin(adminUser);
    renderWithProviders(<AdminBillBackfillPage />);

    // Pick the user.
    const search = screen.getByRole('searchbox', {
      name: /search target user by email or name/i,
    });
    await userEvent.type(search, 'jane');
    await userEvent.click(
      await screen.findByRole('option', { name: /Jane Doe/i })
    );

    await userEvent.type(screen.getByLabelText('Period start'), '2020-01-01');
    await userEvent.type(screen.getByLabelText('Period end'), '2022-01-01');

    expect(
      await screen.findByText(/Range exceeds 365 days/)
    ).toBeInTheDocument();
  });

  it('confirms + submits a valid backfill and appends to the session log', async () => {
    primeAdmin(adminUser);
    let postBody: unknown = null;
    server.use(
      http.post(
        `${API_BASE}/consumption-tax/admin/bills/generate`,
        async ({ request }) => {
          postBody = await request.json();
          return HttpResponse.json({ bill_ids: [1, 2, 3] });
        }
      )
    );

    renderWithProviders(<AdminBillBackfillPage />);

    // Pick the user.
    await userEvent.type(
      screen.getByRole('searchbox', {
        name: /search target user by email or name/i,
      }),
      'jane'
    );
    await userEvent.click(
      await screen.findByRole('option', { name: /Jane Doe/i })
    );

    // Fill a recent, valid date range.
    await userEvent.type(screen.getByLabelText('Period start'), '2026-04-01');
    await userEvent.type(screen.getByLabelText('Period end'), '2026-04-30');

    // Submit -> dialog opens with the resolved identity preview.
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate bills' })
    );
    expect(
      await screen.findByText(/Generate consumption-tax bills for Jane Doe/)
    ).toBeInTheDocument();

    // Confirm in the modal (the second "Generate bills" button is the
    // dialog's confirm).
    const confirmBtns = await screen.findAllByRole('button', {
      name: 'Generate bills',
    });
    await userEvent.click(confirmBtns[confirmBtns.length - 1]!);

    await waitFor(() => expect(postBody).not.toBeNull());
    expect(postBody).toEqual({
      user_id: 42,
      period_start: '2026-04-01',
      period_end: '2026-04-30',
    });
    expect(await screen.findByText('Generated 3 bills.')).toBeInTheDocument();
    // Log entry appears under "Recent backfills (this session)".
    expect(
      await screen.findByText('Recent backfills (this session)')
    ).toBeInTheDocument();
  });

  it('surfaces a friendly error when the BE returns a non-2xx', async () => {
    primeAdmin(adminUser);
    server.use(
      http.post(`${API_BASE}/consumption-tax/admin/bills/generate`, () =>
        HttpResponse.json({ detail: 'BillPeriodTooRecent' }, { status: 400 })
      )
    );

    renderWithProviders(<AdminBillBackfillPage />);

    await userEvent.type(
      screen.getByRole('searchbox', {
        name: /search target user by email or name/i,
      }),
      'jane'
    );
    await userEvent.click(
      await screen.findByRole('option', { name: /Jane Doe/i })
    );
    await userEvent.type(screen.getByLabelText('Period start'), '2026-04-01');
    await userEvent.type(screen.getByLabelText('Period end'), '2026-04-30');

    await userEvent.click(
      screen.getByRole('button', { name: 'Generate bills' })
    );
    const confirmBtns = await screen.findAllByRole('button', {
      name: 'Generate bills',
    });
    await userEvent.click(confirmBtns[confirmBtns.length - 1]!);

    expect(
      await screen.findByText('BillPeriodTooRecent')
    ).toBeInTheDocument();
  });
});
