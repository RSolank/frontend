import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { useMotionStore } from '../../../shared/state/motion.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { useTaxModeStore } from '../../../shared/state/taxMode.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import { weekRangeInTz } from '../../taxation/api/billPeriod';

import { DashboardPage } from './DashboardPage';

const { period_start: WEEK_START, period_end: WEEK_END } = weekRangeInTz(
  new Date(),
  'UTC'
);

// One over-budget category (Dining) so the attention rail has a breach to show.
const populatedBudgetStatus = {
  categories: [
    {
      tag_id: 11,
      tag_name: 'Groceries',
      tag_type: 'essential',
      current_net_expense: 400,
      avg_net_expense: 380,
      min_net_expense: 200,
      max_net_expense: 500,
      limit_amt: 600,
    },
    {
      tag_id: 12,
      tag_name: 'Dining',
      tag_type: 'discretionary',
      current_net_expense: 250,
      avg_net_expense: 150,
      min_net_expense: 100,
      max_net_expense: 250,
      limit_amt: 200, // over-budget
    },
  ],
  total_budget: {
    tag_id: 1,
    tag_name: 'Total Budget',
    tag_type: 'total',
    current_net_expense: 650,
    avg_net_expense: 600,
    limit_amt: 1500,
  },
  currency: 'USD',
  month: '2026-02',
  available_months: ['2026-02'],
};

const populatedTreasury = {
  funded_balance: 48300,
  recognized_revenue: 40000,
  deferred_balance: 8300,
  provisioned_total: 58000,
  currency: 'USD',
  trend: [
    { period_end: '2026-06-14', cumulative_balance: 40000, delta: 1200 },
    { period_end: '2026-06-21', cumulative_balance: 48300, delta: 8300 },
  ],
};

function installCommonHandlers(opts: { breach: boolean }) {
  server.use(
    http.get(`${API_BASE}/budget-limits/status`, () =>
      HttpResponse.json(
        opts.breach
          ? populatedBudgetStatus
          : { ...populatedBudgetStatus, categories: [] }
      )
    ),
    http.get(`${API_BASE}/treasury/summary`, () =>
      HttpResponse.json(populatedTreasury)
    ),
    http.get(`${API_BASE}/transactions`, () =>
      HttpResponse.json({ transactions: [], returned_count: 0 })
    ),
    http.get(`${API_BASE}/consumption-tax/bills`, () =>
      HttpResponse.json({
        bills: [
          {
            bill_id: 7777,
            period_start: WEEK_START,
            period_end: WEEK_END,
            status: 'ACCRUING',
            amount: 15,
            amount_paid: 0,
          },
        ],
      })
    ),
    http.get(`${API_BASE}/consumption-tax/bills/7777`, () =>
      HttpResponse.json({
        bill_id: 7777,
        period_start: WEEK_START,
        period_end: WEEK_END,
        status: 'ACCRUING',
        amount: 15,
        amount_paid: 0,
        totals: { tax_total: 12.5, penalty_total: 2.5 },
        items: [],
      })
    ),
    http.get(`${API_BASE}/metadata/currencies`, () =>
      HttpResponse.json({
        currencies: [{ code: 'USD', label: 'USD - US Dollar', symbol: '$' }],
      })
    )
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    // Snap count-ups to their final value for deterministic assertions.
    useMotionStore.setState({ reducedMotion: true });
    useTaxModeStore.setState({ mode: 'auto' });
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
    useAuthStore.getState().setUser({
      user_id: 1,
      email_id: 'u@example.com',
      first_name: 'Sam',
    });
  });
  afterEach(() => {
    useMotionStore.setState({ reducedMotion: false });
    useTaxModeStore.setState({ mode: 'auto' });
  });

  it('greets the user and labels the active week', async () => {
    installCommonHandlers({ breach: false });
    renderWithProviders(<DashboardPage />);
    expect(
      await screen.findByRole('heading', { name: /Welcome back, Sam/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
  });

  describe('auto mode', () => {
    it('leads with the provision + savings hero and the analytics zone', async () => {
      installCommonHandlers({ breach: false });
      renderWithProviders(<DashboardPage />);

      const hero = await screen.findByTestId('dashboard-hero');
      expect(hero).toHaveAttribute('data-mode', 'auto');
      expect(screen.getByTestId('dashboard-hero-provision')).toBeInTheDocument();
      // Savings funded balance flows from /treasury/summary.
      await waitFor(() =>
        expect(
          screen.getByTestId('dashboard-hero-savings-balance')
        ).toHaveTextContent('48,300')
      );
      // Analytics zone (spend breakdown) + activity zone both present.
      expect(screen.getByTestId('dashboard-analytics')).toBeInTheDocument();
      expect(
        screen.getByTestId('dashboard-activity-zone')
      ).toBeInTheDocument();
    });

    it('surfaces the attention rail only when something needs attention', async () => {
      installCommonHandlers({ breach: true });
      renderWithProviders(<DashboardPage />);
      await waitFor(() =>
        expect(
          screen.getByTestId('dashboard-attention-rail')
        ).toBeInTheDocument()
      );
      expect(screen.getByTestId('dashboard-breach-12')).toHaveTextContent(
        '+$50.00 over'
      );
    });

    it('hides the attention rail when all-clear', async () => {
      installCommonHandlers({ breach: false });
      renderWithProviders(<DashboardPage />);
      // Wait for the hero to settle, then assert the rail is absent.
      await screen.findByTestId('dashboard-hero');
      await waitFor(() =>
        expect(
          screen.getByTestId('dashboard-hero-savings-balance')
        ).toHaveTextContent('48,300')
      );
      expect(
        screen.queryByTestId('dashboard-attention-rail')
      ).not.toBeInTheDocument();
    });
  });

  describe('off mode', () => {
    beforeEach(() => {
      useTaxModeStore.setState({ mode: 'off' });
    });

    it('swaps the spend hero up and demotes savings to the re-enable nudge', async () => {
      installCommonHandlers({ breach: false });
      renderWithProviders(<DashboardPage />);

      const hero = await screen.findByTestId('dashboard-hero');
      expect(hero).toHaveAttribute('data-mode', 'off');
      expect(screen.getByTestId('dashboard-hero-spend')).toBeInTheDocument();
      // Provision/savings hero is gone; the analytics zone holds the nudge.
      expect(
        screen.queryByTestId('dashboard-hero-provision')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('dashboard-savings-placeholder')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-analytics')).not.toBeInTheDocument();
      // ...and the standing tax-mode nudge shows in the attention rail.
      expect(screen.getByTestId('dashboard-tax-mode-off')).toBeInTheDocument();
    });
  });
});
