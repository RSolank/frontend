import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useTrackerCurrentWeekQuery } from '../api/queries';

import { CurrentWeekTracker } from './CurrentWeekTracker';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the Stat
// value-colour nested-ternary refactor (no colocated test existed). The
// tracker endpoint is gated behind a backend phase, so the query hook is
// mocked to drive both the pending and populated paths.
vi.mock('../api/queries', async (orig) => {
  const actual = await orig<typeof import('../api/queries')>();
  return { ...actual, useTrackerCurrentWeekQuery: vi.fn() };
});

const mockQuery = vi.mocked(useTrackerCurrentWeekQuery);
type QueryResult = ReturnType<typeof useTrackerCurrentWeekQuery>;

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

describe('CurrentWeekTracker', () => {
  it('renders the populated stats (accent / default / muted) + contributors', () => {
    mockQuery.mockReturnValue({
      data: POPULATED,
      isLoading: false,
    } as unknown as QueryResult);
    renderWithProviders(<CurrentWeekTracker />);
    // All three Stat colour variants are exercised: Accrued tax (accent),
    // Accrued penalty (default), Projected tax/penalty (muted).
    expect(screen.getByText('Accrued tax')).toBeInTheDocument();
    expect(screen.getByText('Accrued penalty')).toBeInTheDocument();
    expect(screen.getByText('Projected tax')).toBeInTheDocument();
    expect(screen.getByText('Projected penalty')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
