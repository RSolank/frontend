import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useDomainActivityQuery,
  type ActivityFeedItem,
} from '../../../shared/api/activityFeed';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { useTaxModeStore } from '../../../shared/state/taxMode.store';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { useTrackerCurrentWeekQuery } from '../../taxation/api/queries';

import { TaxTrackerCard } from './TaxTrackerCard';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the Stat
// value-colour nested-ternary refactor (no colocated test existed). The
// tracker endpoint is backend-gated, so the query hook is mocked to drive
// both the pending and populated paths. B1 added the tax-mode banner +
// stale-period branches, which mock the domain-activity feed too.
vi.mock('../../taxation/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../taxation/api/queries')>();
  return { ...actual, useTrackerCurrentWeekQuery: vi.fn() };
});
vi.mock('../../../shared/api/activityFeed', async (orig) => {
  const actual = await orig<typeof import('../../../shared/api/activityFeed')>();
  return { ...actual, useDomainActivityQuery: vi.fn() };
});

const mockQuery = vi.mocked(useTrackerCurrentWeekQuery);
const mockDomain = vi.mocked(useDomainActivityQuery);
type QueryResult = ReturnType<typeof useTrackerCurrentWeekQuery>;
type DomainResult = ReturnType<typeof useDomainActivityQuery>;

// A past, closed week relative to "now" — drives the `isStale` branch
// when tax mode is off.
const POPULATED = {
  period_start: '2026-05-25',
  period_end: '2026-05-31',
  running_tax: 100,
  running_penalty: 20,
  projected_tax: 150,
  projected_penalty: 30,
  is_estimate: false,
  per_tag: [
    {
      tag_id: 1,
      tag_name: 'Groceries',
      txn_type: 'essential',
      tax_amount: 50,
      penalty: 5,
    },
  ],
};

// Same numbers but pinned to the *current* ISO week so the stale guard
// is false (off-but-current path keeps projection + progress).
const tz = usePreferencesStore.getState().timezone;
const currentWeek = weekRangeInTz(new Date(), tz);
const POPULATED_CURRENT = {
  ...POPULATED,
  period_start: currentWeek.period_start,
  period_end: currentWeek.period_end,
};

function setTracker(data: unknown) {
  mockQuery.mockReturnValue({ data, isLoading: false } as QueryResult);
}
function setDomain(items: ActivityFeedItem[]) {
  mockDomain.mockReturnValue({
    data: { items, has_more: false },
  } as unknown as DomainResult);
}
function autoDisabledEvent(): ActivityFeedItem {
  return {
    uid: 99,
    kind: 'tax_mode_auto_disabled',
    event_class: 'notification',
    domain: 'taxation',
    subject_type: 'tax_settings',
    subject_id: 'me',
    priority: 1,
    state: 'active',
    summary: 'Auto-finalize was switched off',
    created_at: '2026-06-20T00:00:00Z',
    refreshed_at: '2026-06-20T00:00:00Z',
    aggregate_count: 1,
  };
}

describe('TaxTrackerCard', () => {
  beforeEach(() => {
    useTaxModeStore.setState({ mode: 'auto' });
    setDomain([]);
  });
  afterEach(() => {
    useTaxModeStore.setState({ mode: 'auto' });
    vi.clearAllMocks();
  });

  it('renders the pending empty state when the endpoint returns no data', () => {
    setTracker(null);
    renderWithProviders(<TaxTrackerCard />);
    expect(
      screen.getByText(/No tax accrual yet this week/)
    ).toBeInTheDocument();
  });

  it('renders the populated accrued/projected stats + contributors', () => {
    setTracker(POPULATED_CURRENT);
    renderWithProviders(<TaxTrackerCard />);
    expect(screen.getByTestId('dashboard-tax-accrued')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tax-projected')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tax-contributors')).toHaveTextContent(
      'Groceries'
    );
  });

  it('shows no tax-mode banner while auto-finalize is on', () => {
    setTracker(POPULATED_CURRENT);
    renderWithProviders(<TaxTrackerCard />);
    expect(
      screen.queryByTestId('dashboard-tax-mode-off')
    ).not.toBeInTheDocument();
  });

  it('shows the persistent off-banner but keeps stats when off in the current week', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    setTracker(POPULATED_CURRENT);
    renderWithProviders(<TaxTrackerCard />);
    expect(screen.getByTestId('dashboard-tax-mode-off')).toBeInTheDocument();
    // Current-week data is still valid → projection + progress stay.
    expect(screen.getByTestId('dashboard-tax-projected')).toBeInTheDocument();
  });

  it('suppresses projection/progress and labels the period when off + stale', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    setTracker(POPULATED);
    renderWithProviders(<TaxTrackerCard />);
    expect(screen.getByTestId('dashboard-tax-mode-off')).toBeInTheDocument();
    // Stale: projection is invalid and dropped; accrued survives, labelled.
    expect(
      screen.queryByTestId('dashboard-tax-projected')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tax-accrued')).toBeInTheDocument();
    expect(screen.getByText(/not finalized/)).toBeInTheDocument();
  });

  it('renders the loud auto-disabled notice above the persistent banner', () => {
    useTaxModeStore.setState({ mode: 'manual' });
    setTracker(POPULATED);
    setDomain([autoDisabledEvent()]);
    renderWithProviders(<TaxTrackerCard />);
    expect(
      screen.getByTestId('dashboard-tax-auto-disabled')
    ).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tax-mode-off')).toBeInTheDocument();
  });

  it('hides the auto-disabled notice once tax mode is back on (lingering event)', () => {
    // Enabled, but a stale tax_mode_auto_disabled event still in the feed.
    setTracker(POPULATED_CURRENT);
    setDomain([autoDisabledEvent()]);
    renderWithProviders(<TaxTrackerCard />);
    expect(
      screen.queryByTestId('dashboard-tax-auto-disabled')
    ).not.toBeInTheDocument();
  });
});
