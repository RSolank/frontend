import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMotionStore } from '../../../../shared/state/motion.store';
import { usePreferencesStore } from '../../../../shared/state/preferences.store';
import { useTaxModeStore } from '../../../../shared/state/taxMode.store';
import { renderWithProviders } from '../../../../test/renderWithProviders';
import { useBudgetStatusQuery } from '../../../budgets/api/queries';
import { weekRangeInTz } from '../../../taxation/api/billPeriod';
import { useTrackerCurrentWeekQuery } from '../../../taxation/api/queries';
import { useTreasurySummaryQuery } from '../../../treasury/api/queries';
import { useExpenseTrendQuery } from '../../api/queries';

import { DashboardHero } from './DashboardHero';

// The hero swaps content by taxation mode; numbers come from four feature
// queries, so we mock the hooks (the swap + count-up wiring is the unit under
// test, not the network). Reduced motion is forced on so `useCountUp` snaps to
// the exact figure — no frame-loop flake in assertions.
vi.mock('../../../treasury/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../../treasury/api/queries')>();
  return { ...actual, useTreasurySummaryQuery: vi.fn() };
});
vi.mock('../../../taxation/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../../taxation/api/queries')>();
  return { ...actual, useTrackerCurrentWeekQuery: vi.fn() };
});
vi.mock('../../../budgets/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../../budgets/api/queries')>();
  return { ...actual, useBudgetStatusQuery: vi.fn() };
});
vi.mock('../../api/queries', async (orig) => {
  const actual = await orig<typeof import('../../api/queries')>();
  return { ...actual, useExpenseTrendQuery: vi.fn() };
});

const mockTreasury = vi.mocked(useTreasurySummaryQuery);
const mockTracker = vi.mocked(useTrackerCurrentWeekQuery);
const mockBudget = vi.mocked(useBudgetStatusQuery);
const mockTrend = vi.mocked(useExpenseTrendQuery);

const tz = usePreferencesStore.getState().timezone;
const currentWeek = weekRangeInTz(new Date(), tz);
// A closed week ~2 weeks back — drives the provision hero's stale-week guard
// (computed off "now" so it stays valid whenever the suite runs).
const pastWeek = weekRangeInTz(new Date(Date.now() - 14 * 86_400_000), tz);

function seedQueries() {
  mockTreasury.mockReturnValue({
    data: {
      funded_balance: 48300,
      recognized_revenue: 40000,
      deferred_balance: 8300,
      provisioned_total: 58000,
      currency: 'INR',
      trend: [
        { period_end: '2026-06-14', cumulative_balance: 40000, delta: 1200 },
        { period_end: '2026-06-21', cumulative_balance: 48300, delta: 8300 },
      ],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useTreasurySummaryQuery>);

  mockTracker.mockReturnValue({
    data: {
      period_start: currentWeek.period_start,
      period_end: currentWeek.period_end,
      running_tax: 1000,
      running_penalty: 240,
      projected_tax: 1500,
      projected_penalty: 300,
      is_estimate: false,
      per_tag: [],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useTrackerCurrentWeekQuery>);

  mockBudget.mockReturnValue({
    data: {
      month: '2026-06',
      total_budget: { current_net_expense: 12500, limit_amt: 20000 },
      categories: [],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useBudgetStatusQuery>);

  mockTrend.mockReturnValue({
    data: { period_type: 'weekly', returned_count: 0, rows: [] },
    isLoading: false,
  } as unknown as ReturnType<typeof useExpenseTrendQuery>);
}

describe('DashboardHero', () => {
  beforeEach(() => {
    useMotionStore.setState({ reducedMotion: true });
    seedQueries();
  });
  afterEach(() => {
    useMotionStore.setState({ reducedMotion: false });
    useTaxModeStore.setState({ mode: 'auto' });
    vi.clearAllMocks();
  });

  it('leads with provision + savings when mode is auto', () => {
    useTaxModeStore.setState({ mode: 'auto' });
    renderWithProviders(<DashboardHero />);

    expect(screen.getByTestId('dashboard-hero')).toHaveAttribute(
      'data-mode',
      'auto'
    );
    expect(
      screen.getByTestId('dashboard-hero-provision-accrued')
    ).toHaveTextContent('1,240'); // running_tax + running_penalty
    expect(
      screen.getByTestId('dashboard-hero-savings-balance')
    ).toHaveTextContent('48,300');
    expect(
      screen.getByTestId('dashboard-hero-savings-coverage')
    ).toHaveTextContent('83%'); // 48300 / 58000
    expect(screen.queryByTestId('dashboard-hero-spend')).not.toBeInTheDocument();
  });

  it('keeps the provision + savings hero in manual mode', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    renderWithProviders(<DashboardHero />);

    expect(screen.getByTestId('dashboard-hero')).toHaveAttribute(
      'data-mode',
      'manual'
    );
    expect(screen.getByTestId('dashboard-hero-provision')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-hero-savings')).toBeInTheDocument();
  });

  it('swaps to the spend hero when mode is off', () => {
    useTaxModeStore.setState({ mode: 'off' });
    renderWithProviders(<DashboardHero />);

    expect(screen.getByTestId('dashboard-hero')).toHaveAttribute(
      'data-mode',
      'off'
    );
    expect(screen.getByTestId('dashboard-hero-spend-total')).toHaveTextContent(
      '12,500'
    );
    expect(screen.getByTestId('dashboard-hero-spend-pct')).toHaveTextContent(
      '63% of' // 12500 / 20000
    );
    expect(
      screen.queryByTestId('dashboard-hero-provision')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('dashboard-hero-savings')
    ).not.toBeInTheDocument();
  });

  it('provision hero drops the projection and labels the period when the tracker week is stale', () => {
    // Manual mode can let the accruing bill drift into a past, closed week; the
    // elapsed-fraction projection then extrapolates an old period, so it's
    // dropped and the accrued figure is labelled with the week it covers.
    useTaxModeStore.setState({ mode: 'manual' });
    mockTracker.mockReturnValue({
      data: {
        period_start: pastWeek.period_start,
        period_end: pastWeek.period_end,
        running_tax: 1000,
        running_penalty: 240,
        projected_tax: 1500,
        projected_penalty: 300,
        is_estimate: false,
        per_tag: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useTrackerCurrentWeekQuery>);

    renderWithProviders(<DashboardHero />);

    // Accrued still shows (running_tax + running_penalty).
    expect(
      screen.getByTestId('dashboard-hero-provision-accrued')
    ).toHaveTextContent('1,240');
    // Projection is suppressed; the period is labelled "not finalized".
    expect(
      screen.queryByTestId('dashboard-hero-provision-projected')
    ).not.toBeInTheDocument();
    expect(screen.getByText(/not finalized/)).toBeInTheDocument();
  });
});
