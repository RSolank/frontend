import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { UpcomingBillsWidget } from './UpcomingBillsWidget';

describe('UpcomingBillsWidget', () => {
  test('renders empty state when no upcoming bills', async () => {
    server.use(
      http.get(`${API_BASE}/recurring/upcoming`, () => HttpResponse.json([]))
    );
    renderWithProviders(<UpcomingBillsWidget />);
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-upcoming-empty')).toBeInTheDocument()
    );
  });

  test('renders up to MAX_ROWS bills + a "more in Recurring" hint', async () => {
    const bills = Array.from({ length: 7 }, (_, i) => ({
      uid: i + 1,
      template_id: 1,
      beneficiary_id: 1,
      expected_amount: 50,
      debit_credit: 'debit',
      due_date: '2026-06-05',
      status: 'pending',
      matched_txn_id: null,
    }));
    server.use(
      http.get(`${API_BASE}/recurring/upcoming`, () =>
        HttpResponse.json(bills)
      ),
      http.get(`${API_BASE}/beneficiaries`, () =>
        HttpResponse.json([
          {
            uid: 1,
            name: 'Comcast',
            aliases: [],
            beneficiary_type: 'merchant',
          },
        ])
      )
    );
    renderWithProviders(<UpcomingBillsWidget />);
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-upcoming-list')).toBeInTheDocument()
    );
    // 5 rows max (MAX_ROWS = 5)
    expect(screen.getAllByTestId(/dashboard-upcoming-row-/)).toHaveLength(5);
    expect(screen.getByText(/more in Recurring/i)).toBeInTheDocument();
  });
});
