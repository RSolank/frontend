import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useDomainActivityQuery,
  type ActivityFeedItem,
} from '../../../shared/api/activityFeed';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { useTaxModeStore } from '../../../shared/state/taxMode.store';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useBudgetStatusQuery } from '../../budgets/api/queries';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { useBillsQuery } from '../../taxation/api/queries';

import { NeedsAttentionRail } from './NeedsAttentionRail';

vi.mock('../../budgets/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../budgets/api/queries')>();
  return { ...actual, useBudgetStatusQuery: vi.fn() };
});
vi.mock('../../../shared/api/activityFeed', async (orig) => {
  const actual = await orig<typeof import('../../../shared/api/activityFeed')>();
  return { ...actual, useDomainActivityQuery: vi.fn() };
});
vi.mock('../../taxation/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../taxation/api/queries')>();
  return { ...actual, useBillsQuery: vi.fn() };
});

const mockBudget = vi.mocked(useBudgetStatusQuery);
const mockFeed = vi.mocked(useDomainActivityQuery);
const mockBills = vi.mocked(useBillsQuery);

function setBudget(categories: unknown[]) {
  mockBudget.mockReturnValue({
    data: { categories, total_budget: null },
  } as unknown as ReturnType<typeof useBudgetStatusQuery>);
}
function setFeed(items: ActivityFeedItem[]) {
  mockFeed.mockReturnValue({
    data: { items, has_more: false },
  } as unknown as ReturnType<typeof useDomainActivityQuery>);
}
function setBills(bills: unknown[]) {
  mockBills.mockReturnValue({
    data: { bills },
  } as unknown as ReturnType<typeof useBillsQuery>);
}

const tz = 'UTC';
const currentWeek = weekRangeInTz(new Date(), tz);
const pastWeek = weekRangeInTz(new Date(Date.now() - 14 * 86_400_000), tz);

const breachedCategory = {
  tag_id: 12,
  tag_name: 'Dining',
  current_net_expense: 250,
  limit_amt: 200, // over by 50
  avg_net_expense: 150,
  max_net_expense: 250,
};

function feedItem(kind: string): ActivityFeedItem {
  return {
    uid: 1,
    kind,
    event_class: kind === 'bill_overdue' ? 'alert' : 'notification',
    domain: 'taxation',
    subject_type: 'bill',
    subject_id: '42',
    priority: 1,
    state: 'active',
    summary: kind === 'bill_overdue' ? 'A bill is overdue' : 'Auto-finalize off',
    created_at: '2026-06-20T00:00:00Z',
    refreshed_at: '2026-06-20T00:00:00Z',
    aggregate_count: 1,
  } as unknown as ActivityFeedItem;
}

describe('NeedsAttentionRail', () => {
  beforeEach(() => {
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
    useTaxModeStore.setState({ mode: 'auto' });
    setBudget([]);
    setFeed([]);
    setBills([]);
  });
  afterEach(() => {
    useTaxModeStore.setState({ mode: 'auto' });
    vi.clearAllMocks();
  });

  it('renders nothing when all-clear (no breach, no overdue, auto on)', () => {
    const { container } = renderWithProviders(<NeedsAttentionRail />);
    expect(
      screen.queryByTestId('dashboard-attention-rail')
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('surfaces budget breaches', () => {
    setBudget([breachedCategory]);
    renderWithProviders(<NeedsAttentionRail />);
    expect(screen.getByTestId('dashboard-attention-rail')).toBeInTheDocument();
    // Over = 250 − 200 = 50 (symbol-agnostic — the metadata currency query
    // isn't mounted in this standalone unit render).
    expect(screen.getByTestId('dashboard-breach-12')).toHaveTextContent(
      '50.00 over'
    );
  });

  it('surfaces overdue bills', () => {
    setFeed([feedItem('bill_overdue')]);
    renderWithProviders(<NeedsAttentionRail />);
    expect(screen.getByTestId('dashboard-overdue-bills')).toBeInTheDocument();
  });

  it('shows the tax-mode nudge when auto-finalize is off', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    renderWithProviders(<NeedsAttentionRail />);
    expect(screen.getByTestId('dashboard-tax-mode-off')).toBeInTheDocument();
  });

  it('shows the loud auto-disabled notice above the nudge in manual mode', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    setFeed([feedItem('tax_mode_auto_disabled')]);
    renderWithProviders(<NeedsAttentionRail />);
    expect(
      screen.getByTestId('dashboard-tax-auto-disabled')
    ).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tax-mode-off')).toBeInTheDocument();
  });

  it('does not show the auto-disabled notice in off mode (deliberate opt-out)', () => {
    useTaxModeStore.setState({ mode: 'off' });
    setFeed([feedItem('tax_mode_auto_disabled')]);
    renderWithProviders(<NeedsAttentionRail />);
    // The standing nudge still shows, but not the loud "we switched it off".
    expect(screen.getByTestId('dashboard-tax-mode-off')).toBeInTheDocument();
    expect(
      screen.queryByTestId('dashboard-tax-auto-disabled')
    ).not.toBeInTheDocument();
  });

  it('prompts to generate bills when a completed week is still un-generated (manual)', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    setBills([
      { bill_id: 1, status: 'ACCRUING', period_end: pastWeek.period_end },
    ]);
    renderWithProviders(<NeedsAttentionRail />);
    expect(screen.getByTestId('dashboard-generate-bills')).toBeInTheDocument();
  });

  it('hides the generate prompt when only the current week is still accruing', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    setBills([
      // current-week accruing = in progress, not a missed generation
      { bill_id: 2, status: 'ACCRUING', period_end: currentWeek.period_end },
      // prior week already finalized
      { bill_id: 3, status: 'BILLED', period_end: pastWeek.period_end },
    ]);
    renderWithProviders(<NeedsAttentionRail />);
    expect(
      screen.queryByTestId('dashboard-generate-bills')
    ).not.toBeInTheDocument();
  });

  it('does not prompt to generate in auto mode even with a past accruing bill', () => {
    useTaxModeStore.setState({ mode: 'auto' });
    setBills([
      { bill_id: 4, status: 'ACCRUING', period_end: pastWeek.period_end },
    ]);
    renderWithProviders(<NeedsAttentionRail />);
    expect(
      screen.queryByTestId('dashboard-generate-bills')
    ).not.toBeInTheDocument();
  });
});
