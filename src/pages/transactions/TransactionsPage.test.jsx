import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TransactionsPage } from './TransactionsPage';
import { apiFetch } from '../../utils/apiClient';

vi.mock('../../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockUser = {
  first_name: 'John',
  currency: '₹'
};

vi.mock('../../state/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser
  })
}));

const mockTags = {
  tags: [
    { tag_id: 10, tag_name: 'Food' },
    { tag_id: 20, tag_name: 'Income' }
  ]
};

const mockTransactions = {
  transactions: [
    {
      txn_id: 1,
      txn_date: '2023-10-01',
      beneficiary: 'Supermarket',
      amount: 150,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [10]
    },
    {
      txn_id: 2,
      txn_date: '2023-10-02',
      beneficiary: 'Salary',
      amount: 5000,
      debit_credit: 'credit',
      source: 'statement',
      tag_ids: [20]
    }
  ]
};

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders transactions table with tags and loads data', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/api/transactions')) return Promise.resolve(mockTransactions);
      if (url === '/api/tags') return Promise.resolve(mockTags);
      return Promise.resolve({});
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Supermarket')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Income')).toBeInTheDocument();
    });
  });

  it('shows action dropdown only for manual transactions', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/api/transactions')) return Promise.resolve(mockTransactions);
      if (url === '/api/tags') return Promise.resolve(mockTags);
      return Promise.resolve({});
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Supermarket')).toBeInTheDocument());

    // Manual transaction (Supermarket) should have the ▼ button
    const toggleButtons = screen.getAllByRole('button', { name: '▼' });
    expect(toggleButtons).toHaveLength(1);

    // Statement transaction (Salary) should NOT have a ▼ button
    const salaryRow = screen.getByText('Salary').closest('tr');
    expect(salaryRow).not.toContainElement(screen.queryByRole('button', { name: '▼' }));
  });

  it('handles pagination', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/api/transactions')) {
          if (url.includes('offset=20')) return Promise.resolve({ transactions: [{ ...mockTransactions.transactions[0], txn_id: 100 }] });
          return Promise.resolve({ transactions: Array.from({ length: 20 }, (_, i) => ({ ...mockTransactions.transactions[0], txn_id: i })) });
      }
      if (url === '/api/tags') return Promise.resolve(mockTags);
      return Promise.resolve({});
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Next')).not.toBeDisabled());

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('offset=20'));
    });
  });

  it('handles deletion for manual transactions via dropdown', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/api/transactions')) return Promise.resolve(mockTransactions);
      if (url === '/api/tags') return Promise.resolve(mockTags);
      return Promise.resolve({});
    });
    
    window.confirm = vi.fn(() => true);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TransactionsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Supermarket')).toBeInTheDocument());

    // 1. Open dropdown
    const toggleButton = screen.getByRole('button', { name: '▼' });
    fireEvent.click(toggleButton);

    // 2. Click Delete
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/transactions/1', expect.objectContaining({ method: 'DELETE' }));
    });
  });
});
