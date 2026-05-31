import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useBudgetStatusQuery } from '../../budgets/api/queries';

import { ExpenseTrackerCard } from './ExpenseTrackerCard';

// Smoke / behaviour coverage added in Batch 10.11 round-2, alongside the
// view-model (`useExpenseTrackerView`) extraction that pulled the derived
// state out of the component to bring its complexity under the gate. No
// colocated test existed before. The budget-status query hook is mocked to
// drive the loading / fresh-signup / populated branches deterministically.
// The nested WeekByCategoryStrip runs its own (MSW-backed) queries and
// hides itself when there's no weekly spend, so it stays out of the way.
vi.mock('../../budgets/api/queries', async (orig) => {
  const actual = await orig<typeof import('../../budgets/api/queries')>();
  return { ...actual, useBudgetStatusQuery: vi.fn() };
});

const mockQuery = vi.mocked(useBudgetStatusQuery);
type QueryResult = ReturnType<typeof useBudgetStatusQuery>;

function mockStatus(data: unknown, isLoading = false) {
  mockQuery.mockReturnValue({ data, isLoading } as unknown as QueryResult);
}

describe('ExpenseTrackerCard', () => {
  it('renders the loading state while the first fetch is in flight', () => {
    mockStatus(undefined, true);
    renderWithProviders(<ExpenseTrackerCard />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the fresh-signup empty state when there is no spend and no limit', () => {
    mockStatus({ categories: [], total_budget: null, month: '2026-05' });
    renderWithProviders(<ExpenseTrackerCard />);
    expect(screen.getByText('No budgets configured')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Set your first budget' })
    ).toBeInTheDocument();
  });

  it('renders the rollup, top categories, and a breach chip when over limit', async () => {
    mockStatus({
      month: '2026-05',
      total_budget: { tag_id: 0, tag_name: 'Total', current_net_expense: 570, limit_amt: 1000 },
      categories: [
        { tag_id: 1, tag_name: 'Groceries', current_net_expense: 300, limit_amt: 200 },
        { tag_id: 2, tag_name: 'Transport', current_net_expense: 120, limit_amt: 150 },
        { tag_id: 3, tag_name: 'Misc', current_net_expense: 0, limit_amt: 0 },
      ],
    });
    renderWithProviders(<ExpenseTrackerCard />);

    // Total rollup formats with the active currency symbol.
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-expense-rollup')).toHaveTextContent(
        '$570.00'
      )
    );
    // One category (Groceries 300 > 200) is breached → chip shows the count.
    expect(
      screen.getByTestId('dashboard-expense-breach-chip')
    ).toHaveTextContent('1 over budget');
    // Active categories are listed; the spend-0 / no-limit one is filtered out.
    expect(
      screen.getByTestId('dashboard-expense-category-1')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-expense-category-2')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('dashboard-expense-category-3')
    ).not.toBeInTheDocument();
  });

  it('shows the month chip (no breach chip) when nothing is over limit', () => {
    mockStatus({
      month: '2026-05',
      total_budget: { tag_id: 0, tag_name: 'Total', current_net_expense: 50, limit_amt: 1000 },
      categories: [
        { tag_id: 1, tag_name: 'Groceries', current_net_expense: 50, limit_amt: 200 },
      ],
    });
    renderWithProviders(<ExpenseTrackerCard />);
    expect(
      screen.queryByTestId('dashboard-expense-breach-chip')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-expense-category-1')
    ).toBeInTheDocument();
  });
});
