import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import type { TreasurySummary } from '../api/queries';

// Populated summary fixture — recognized 300 + deferred 200 = funded 500, with
// 600 provisioned (coverage 83%) and a four-week cumulative trend (≤5 buckets
// → the trend renders as bars).
const populated = {
  funded_balance: 500,
  recognized_revenue: 300,
  deferred_balance: 200,
  provisioned_total: 600,
  currency: 'USD',
  trend: [
    { period_end: '2026-06-07', cumulative_balance: 100, delta: 100 },
    { period_end: '2026-06-14', cumulative_balance: 250, delta: 150 },
    { period_end: '2026-06-21', cumulative_balance: 400, delta: 150 },
    { period_end: '2026-06-28', cumulative_balance: 500, delta: 100 },
  ],
};

function useSummary(body: TreasurySummary) {
  server.use(http.get(`${API_BASE}/treasury/summary`, () => HttpResponse.json(body)));
}

describe('SavingsPage', () => {
  beforeEach(() => {
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
  });

  it('renders the empty state when nothing is set aside or provisioned', async () => {
    // Default MSW handler returns a zeroed summary.
    const { SavingsPage } = await import('./SavingsPage');
    renderWithProviders(<SavingsPage />);

    expect(await screen.findByTestId('savings-empty-state')).toBeInTheDocument();
    // No headline number renders in the empty state.
    expect(screen.queryByTestId('savings-funded-balance')).not.toBeInTheDocument();
  });

  it('renders the headline, composition split, and trend when populated', async () => {
    useSummary(populated);
    const { SavingsPage } = await import('./SavingsPage');
    renderWithProviders(<SavingsPage />);

    // Zone 1 — set-aside hero + framing stats.
    const funded = await screen.findByTestId('savings-funded-balance');
    expect(funded).toHaveTextContent('$500.00');
    expect(screen.getByTestId('savings-provisioned-total')).toHaveTextContent(
      '$600.00'
    );
    // Coverage = 500 / 600 = 83%.
    expect(screen.getByTestId('savings-coverage')).toHaveTextContent('83%');

    // Zone 2 — composition. Both segments present (deferred > 0) with amounts.
    expect(screen.getByTestId('savings-legend-recognized')).toHaveTextContent(
      '$300.00'
    );
    expect(screen.getByTestId('savings-legend-deferred')).toHaveTextContent(
      '$200.00'
    );
    expect(
      screen.getByTestId('savings-composition-deferred-segment')
    ).toBeInTheDocument();

    // Zone 3 — trend section renders.
    expect(screen.getByText('Set aside over time')).toBeInTheDocument();
  });

  it('collapses the composition bar to a single segment when there is no surplus', async () => {
    useSummary({
      ...populated,
      funded_balance: 300,
      recognized_revenue: 300,
      deferred_balance: 0,
    });
    const { SavingsPage } = await import('./SavingsPage');
    renderWithProviders(<SavingsPage />);

    await screen.findByTestId('savings-funded-balance');
    // The amber deferred segment is omitted entirely; the legend still lists it at zero.
    expect(
      screen.queryByTestId('savings-composition-deferred-segment')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('savings-legend-deferred')).toHaveTextContent(
      '$0.00'
    );
  });

  it('surfaces an error banner when the summary request fails', async () => {
    server.use(
      http.get(
        `${API_BASE}/treasury/summary`,
        () => new HttpResponse(null, { status: 500 })
      )
    );
    const { SavingsPage } = await import('./SavingsPage');
    renderWithProviders(<SavingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load your savings summary.'
    );
  });
});
