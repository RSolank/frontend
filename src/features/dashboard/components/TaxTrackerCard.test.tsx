import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useTrackerCurrentWeekQuery } from '../../taxation/api/queries';

import { TaxTrackerCard } from './TaxTrackerCard';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the Stat
// value-colour nested-ternary refactor (no colocated test existed). The
// tracker endpoint is backend-gated, so the query hook is mocked to drive
// both the pending and populated paths.
vi.mock('../../taxation/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../taxation/api/queries')>();
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

describe('TaxTrackerCard', () => {
  it('renders the pending empty state when the endpoint returns no data', () => {
    mockQuery.mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as QueryResult);
    renderWithProviders(<TaxTrackerCard />);
    expect(
      screen.getByText(/No tax accrual yet this week/)
    ).toBeInTheDocument();
  });

  it('renders the populated accrued/projected stats + contributors', () => {
    mockQuery.mockReturnValue({
      data: POPULATED,
      isLoading: false,
    } as unknown as QueryResult);
    renderWithProviders(<TaxTrackerCard />);
    expect(screen.getByTestId('dashboard-tax-accrued')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tax-projected')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tax-contributors')).toHaveTextContent(
      'Groceries'
    );
  });
});
