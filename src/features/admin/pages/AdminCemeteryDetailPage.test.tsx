import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AdminCemeteryDetailPage } from './AdminCemeteryDetailPage';

// BE T-admin C1 — cemetery detail pinning tests.

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

function renderDetail(id = '51') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/admin/cemetery/:deletedUserId"
        element={<AdminCemeteryDetailPage />}
      />
    </Routes>,
    { initialEntries: [`/admin/cemetery/${id}`] }
  );
}

const detailBody = {
  deleted_user_id: 51,
  former_user_id: 42,
  email: 'gone@example.test',
  deleted_at: '2026-05-15T08:00:00Z',
  account_opened_at: '2025-08-01T00:00:00Z',
  country: 'India',
  currency: 'INR',
  committee_bill_replicas_count: 12,
  expense_total_replicas_count: 5,
  committee_bill_replicas: [
    {
      original_bill_id: 9001,
      amount: 250.5,
      bill_status: 'BILLED',
      period_start: '2026-04-01',
      period_end: '2026-04-07',
      billed_at: '2026-04-08T10:00:00Z',
    },
  ],
  expense_total_replicas: [
    {
      period_type: 'monthly',
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      total_count: 42,
      total_debit: 5000,
      total_credit: 0,
    },
  ],
};

describe('AdminCemeteryDetailPage', () => {
  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('renders the Not-available panel for non-admin users', () => {
    primeAdmin({ user_id: 2, email_id: 'user@example.test', role: 'user' });
    renderDetail();
    expect(
      screen.getByRole('heading', { name: 'Not available' })
    ).toBeInTheDocument();
  });

  it('renders headstone summary for an admin', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/cemetery/:id`, () =>
        HttpResponse.json(detailBody)
      )
    );

    renderDetail('51');

    expect(
      await screen.findByRole('heading', { name: 'gone@example.test' })
    ).toBeInTheDocument();
    // Headstone fields rendered (12 bills + 5 expense replicas).
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('India')).toBeInTheDocument();
  });

  it('expands the Committee-bill replicas section on click', async () => {
    primeAdmin(adminUser);
    server.use(
      http.get(`${API_BASE}/admin/cemetery/:id`, () =>
        HttpResponse.json(detailBody)
      )
    );

    renderDetail('51');
    await screen.findByRole('heading', { name: 'gone@example.test' });

    // Sections are collapsed by default — the bill_id 9001 isn't in the DOM.
    expect(screen.queryByText('9001')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /committee-bill replicas/i })
    );

    expect(await screen.findByText('9001')).toBeInTheDocument();
  });

  it('renders the not-found panel on 404 (default handler)', async () => {
    primeAdmin(adminUser);
    // Default MSW handler is 404.
    renderDetail('999');
    expect(
      await screen.findByRole('heading', { name: 'Headstone not found' })
    ).toBeInTheDocument();
  });
});
