import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BudgetsTab } from './BudgetsTab';
import { apiFetch } from '../../utils/apiClient';

// Mock apiFetch
vi.mock('../../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

// Mock useAuth
vi.mock('../../state/AuthContext', () => ({
  useAuth: () => ({ user: { user_id: 1, first_name: 'Test', currency: '$' } })
}));

describe('BudgetsTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockStatusResponse = {
    categories: [
      {
        tag_id: 2,
        tag_name: 'Groceries',
        tag_type: 'expense',
        current_expense: 300,
        avg_expense: 250,
        min_expense: 200,
        max_expense: 400,
        limit_amt: 350,
        penalty_rate: 0.05,
        default_penalty_rate: 0.05
      },
      {
        tag_id: 3,
        tag_name: 'Dining',
        tag_type: 'expense',
        current_expense: 150,
        avg_expense: 100,
        min_expense: 50,
        max_expense: 200,
        limit_amt: null,
        penalty_rate: null,
        default_penalty_rate: 0.1
      }
    ],
    total_budget: {
      uid: 1,
      limit_amt: 2000,
      penalty_rate: 0,
      current_expense: 450,
      avg_expense: 350,
      min_expense: 250,
      max_expense: 600
    },
    currency: '$',
    month: '2023-10',
    available_months: ['2023-10', '2023-09']
  };

  it('renders loading state and then budget data', async () => {
    apiFetch.mockResolvedValueOnce(mockStatusResponse);

    render(<BudgetsTab />);

    expect(screen.getByText(/Refreshing budget status/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Refreshing budget status/i)).not.toBeInTheDocument();
    });

    // Check Total Budget
    expect(screen.getByText('Total Monthly Budget')).toBeInTheDocument();
    expect(screen.getByText('$450')).toBeInTheDocument(); // total current
    expect(screen.getByText('/ $2,000')).toBeInTheDocument(); // total limit

    // Check Categories
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('$300')).toBeInTheDocument(); // Groceries current
    expect(screen.getByText('/ $350')).toBeInTheDocument(); // Groceries limit
  });

  it('handles setting a new budget', async () => {
    apiFetch.mockResolvedValueOnce(mockStatusResponse);

    render(<BudgetsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Dining')).toBeInTheDocument();
    });

    // Click Set Budget for Dining (which has limit_amt: null)
    const setBudgetBtns = screen.getAllByText('Set Budget');
    expect(setBudgetBtns.length).toBeGreaterThan(0);
    fireEvent.click(setBudgetBtns[0]);

    // Form appears
    expect(screen.getByText('Monthly Limit')).toBeInTheDocument();
    
    // Simulate user editing slider & penalty
    const saveBtns = screen.getAllByText('Save');
    expect(saveBtns.length).toBeGreaterThan(0);

    apiFetch.mockResolvedValueOnce({ budget: { limit_amt: 150, penalty_rate: 0.1 } });
    apiFetch.mockResolvedValueOnce(mockStatusResponse); // Reload loadStatus

    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/budget-limits', expect.objectContaining({
        method: 'POST',
        body: expect.any(String)
      }));
    });
  });
});
