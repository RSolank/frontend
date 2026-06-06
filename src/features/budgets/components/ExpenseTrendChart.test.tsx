import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { ExpenseTrendChart } from './ExpenseTrendChart';

const TOTAL_TAG_ID = 1;

const SAMPLE_ROWS = [
  {
    tag_id: TOTAL_TAG_ID,
    tag_name: 'Total',
    period_type: 'monthly' as const,
    period_start: '2025-12-01',
    period_end: '2025-12-31',
    total_count: 18,
    total_debit: 800,
    total_credit: 50,
    net_expense: 750,
    avg_net_expense: 600,
    min_net_expense: 400,
    max_net_expense: 800,
  },
  {
    tag_id: TOTAL_TAG_ID,
    tag_name: 'Total',
    period_type: 'monthly' as const,
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    total_count: 22,
    total_debit: 1100,
    total_credit: 100,
    net_expense: 1000,
    avg_net_expense: 700,
    min_net_expense: 400,
    max_net_expense: 1000,
  },
  {
    tag_id: TOTAL_TAG_ID,
    tag_name: 'Total',
    period_type: 'monthly' as const,
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    total_count: 15,
    total_debit: 500,
    total_credit: 0,
    net_expense: 500,
    avg_net_expense: 700,
    min_net_expense: 400,
    max_net_expense: 1000,
  },
];

describe('<ExpenseTrendChart>', () => {
  beforeEach(() => {
    useAuthStore.setState({
      constants: {
        TOTAL_TAG_ID,
        MISCELLANEOUS_TAG_ID: 2,
        CONSUMPTION_TAX_TAG_ID: 3,
        TAXABLE_TXN_TYPES: ['debit'],
        VALID_TAG_TYPES: [
          'essential',
          'discretionary',
          'committed',
          'exempted',
        ],
        VALID_TXN_TYPES: ['debit', 'credit'],
        RELATIONSHIP_TYPES: ['friend', 'family'],
      },
    });
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
  });

  it('renders one bar per returned monthly bucket of the Total tag', async () => {
    server.use(
      http.get(`${API_BASE}/expense-tracker/`, () =>
        HttpResponse.json({
          period_type: 'monthly',
          returned_count: SAMPLE_ROWS.length,
          rows: SAMPLE_ROWS,
        })
      )
    );

    renderWithProviders(<ExpenseTrendChart />);
    await waitFor(() => {
      expect(screen.getByTestId('trend-bar-0')).toBeInTheDocument();
    });
    expect(screen.getByTestId('trend-bar-1')).toBeInTheDocument();
    expect(screen.getByTestId('trend-bar-2')).toBeInTheDocument();
    // The 4th bar must NOT render (only 3 buckets in the fixture).
    expect(screen.queryByTestId('trend-bar-3')).not.toBeInTheDocument();
  });

  it('renders the empty-state copy when the backend has no buckets yet', async () => {
    renderWithProviders(<ExpenseTrendChart />);
    await waitFor(() => {
      expect(
        screen.getByText(/spend across at least one full month/i)
      ).toBeInTheDocument();
    });
  });

  it('filters out rows that are not the Total tag', async () => {
    server.use(
      http.get(`${API_BASE}/expense-tracker/`, () =>
        HttpResponse.json({
          period_type: 'monthly',
          returned_count: 2,
          rows: [
            { ...SAMPLE_ROWS[0]!, tag_id: 99, tag_name: 'Groceries' },
            SAMPLE_ROWS[1]!,
          ],
        })
      )
    );

    renderWithProviders(<ExpenseTrendChart />);
    await waitFor(() => {
      expect(screen.getByTestId('trend-bar-0')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('trend-bar-1')).not.toBeInTheDocument();
  });
});
