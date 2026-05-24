import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { apiFetch } from '../shared/api/apiClient';

import { DashboardPage } from './Dashboard';

vi.mock('../shared/api/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockUser = {
  first_name: 'John',
  last_name: 'Doe',
  currency: '₹',
};

const mockLogout = vi.fn();

vi.mock('../features/auth/state/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    constants: {
      MISCELLANEOUS_TAG_ID: 2,
      TOTAL_TAG_ID: 1,
    },
    logout: mockLogout,
  }),
}));

const mockTags = {
  tags: [
    { tag_id: 1, tag_name: 'Food', children: [] },
    { tag_id: 2, tag_name: 'Groceries', children: [] },
  ],
};

const mockTransactions = {
  transactions: [
    {
      txn_id: 1,
      txn_date: '2023-10-01',
      beneficiary: 'Supermarket',
      amount: 100,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [2],
    },
  ],
};

const mockBudgets = {
  total_budget: { current_expense: 500, limit_amt: 1000 },
  categories: [
    { tag_id: 1, tag_name: 'Food', current_expense: 200, limit_amt: 300 },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders dashboard with budgets and transactions', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      if (url.includes('/api/transactions')) return mockTransactions;
      if (url === '/api/budget-limits/status') return mockBudgets;
      if (url === '/api/consumption-tax/bills') return { bills: [] };
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <DashboardPage />
      </MemoryRouter>
    );

    // Use findBy to wait for initial text
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    // Check for John - might be multiple, so check if at least one is present
    const johns = await screen.findAllByText(/John/i);
    expect(johns.length).toBeGreaterThan(0);

    expect(screen.getByText('TOTAL BUDGET')).toBeInTheDocument();

    // Check for ₹500
    await waitFor(() => {
      // Look for the text specifically in a heading or just any element
      const textNodes = screen.getAllByText((content, element) => {
        return (
          element.tagName.toLowerCase() === 'h2' &&
          content.includes('₹') &&
          content.includes('500')
        );
      });
      expect(textNodes.length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Supermarket')).toBeInTheDocument();
  });

  it('displays tax summary badge if tax exists', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      if (url.includes('/api/transactions')) return mockTransactions;
      if (url === '/api/budget-limits/status') return mockBudgets;
      if (url === '/api/consumption-tax/bills') {
        const currentMonth = new Date().toISOString().slice(0, 7);
        return { bills: [{ period_start: currentMonth, total_amount: 15.5 }] };
      }
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Tax: ₹15.50/i)).toBeInTheDocument();
    });
  });

  it('handles logout via user menu', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      if (url.includes('/api/transactions')) return mockTransactions;
      if (url === '/api/budget-limits/status') return mockBudgets;
      if (url === '/api/consumption-tax/bills') return { bills: [] };
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText(/Welcome back/i);

    // Click the button that contains "John"
    const menuBtn = screen.getByRole('button', { name: /John/i });
    fireEvent.click(menuBtn);

    await waitFor(() => expect(screen.getByText('Logout')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Logout'));
    expect(mockLogout).toHaveBeenCalled();
  });
});
