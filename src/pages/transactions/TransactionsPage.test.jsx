import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { apiFetch } from '../../shared/api/apiClient';

import { TransactionsPage } from './TransactionsPage';

vi.mock('../../shared/api/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockUser = {
  first_name: 'John',
  currency: '₹',
};

vi.mock('../../features/auth/state/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

const mockTags = {
  tags: [
    { tag_id: 10, tag_name: 'Food' },
    { tag_id: 20, tag_name: 'Income' },
  ],
};

const mockTransactions = {
  transactions: [
    {
      txn_id: 1,
      txn_date: '2023-10-01',
      beneficiary_id: 10,
      beneficiary_name: 'Supermarket',
      beneficiary: 'Supermarket',
      amount: 150,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [10],
    },
    {
      txn_id: 2,
      txn_date: '2023-10-02',
      beneficiary_name: 'Salary',
      beneficiary: 'Salary',
      amount: 5000,
      debit_credit: 'credit',
      source: 'statement',
      tag_ids: [20],
    },
  ],
  returned_count: 2,
};

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders transactions table with tags and loads data', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('transactions')) return mockTransactions;
      if (url.includes('tags')) return mockTags;
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Supermarket')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getAllByText('Food').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    });

    expect(screen.getByRole('link', { name: 'Beneficiaries' })).toHaveAttribute(
      'href',
      '/beneficiaries'
    );
    expect(screen.getByRole('link', { name: 'Supermarket' })).toHaveAttribute(
      'href',
      '/beneficiaries/10'
    );
  });

  it('shows action dropdown only for manual transactions', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('transactions')) return mockTransactions;
      if (url.includes('tags')) return mockTags;
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    // Manual transaction (Supermarket) should have the ▼ button
    const toggleButtons = screen.getAllByRole('button', { name: '▼' });
    expect(toggleButtons).toHaveLength(1);

    // Statement transaction (Salary) should NOT have a ▼ button
    const salaryRow = screen.getByText('Salary').closest('tr');
    expect(salaryRow).not.toContainElement(
      screen.queryByRole('button', { name: '▼' })
    );
  });

  it('handles pagination', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('transactions')) {
        if (url.includes('offset=25'))
          return {
            transactions: [
              { ...mockTransactions.transactions[0], txn_id: 100 },
            ],
            returned_count: 1,
          };
        return {
          transactions: Array.from({ length: 25 }, (_, i) => ({
            ...mockTransactions.transactions[0],
            txn_id: i,
          })),
          returned_count: 25,
        };
      }
      if (url.includes('tags')) return mockTags;
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Next')).not.toBeDisabled());

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=25')
      );
    });
  });

  it('merchant view links name to beneficiary and details filters transactions', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('group_by=merchant')) {
        return {
          groups: [
            {
              beneficiary_id: 42,
              beneficiary_name: 'Coffee Shop',
              frequency: 3,
              total_amount: -450,
            },
          ],
          returned_count: 1,
        };
      }
      if (url.includes('beneficiary_id=42')) {
        return {
          transactions: [{ ...mockTransactions.transactions[0], txn_id: 99 }],
          returned_count: 1,
        };
      }
      if (url.includes('transactions')) return mockTransactions;
      if (url.includes('tags')) return mockTags;
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText('Merchant View'));

    await waitFor(() =>
      expect(screen.getByText('Coffee Shop')).toBeInTheDocument()
    );

    expect(screen.getByRole('link', { name: 'Coffee Shop' })).toHaveAttribute(
      'href',
      '/beneficiaries/42'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('beneficiary_id=42')
      );
    });
  });

  it('handles deletion for manual transactions via dropdown', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('transactions')) return mockTransactions;
      if (url.includes('tags')) return mockTags;
      return {};
    });

    window.confirm = vi.fn(() => true);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    // 1. Open dropdown
    const toggleButton = screen.getByRole('button', { name: '▼' });
    fireEvent.click(toggleButton);

    // 2. Click Delete
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/transactions/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
