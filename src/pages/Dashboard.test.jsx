import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './Dashboard';
import { apiFetch } from '../utils/apiClient';

vi.mock('../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockUser = {
  first_name: 'John',
  last_name: 'Doe',
  currency: '₹'
};

const mockLogout = vi.fn();

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout
  })
}));

const mockTags = {
  tags: [
    { tag_id: 1, tag_name: 'Food', children: [] },
    { tag_id: 2, tag_name: 'Groceries', children: [] }
  ]
};

const mockTransactions = {
  transactions: [
    {
      txn_id: 1,
      txn_date: '2023-10-01',
      merchant: 'Supermarket',
      amount: 100,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [2]
    }
  ]
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders dashboard with transactions and user info', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      if (url.includes('/api/transactions')) return mockTransactions;
      return {};
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Welcome, John Doe!/i)).toBeInTheDocument();
      expect(screen.getByText('Supermarket')).toBeInTheDocument();
      expect(screen.getByText('₹100')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });
  });

  it('handles transaction deletion', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      if (url.includes('/api/transactions')) return mockTransactions;
      return {};
    });

    window.confirm = vi.fn(() => true);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Supermarket')).toBeInTheDocument());

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(apiFetch).toHaveBeenCalledWith('/api/transactions/1', { method: 'DELETE' });
      expect(screen.queryByText('Supermarket')).not.toBeInTheDocument();
    });
  });

  it('handles logout', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      if (url.includes('/api/transactions')) return mockTransactions;
      return {};
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Logout')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Logout'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('handles pagination', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      return { transactions: Array.from({ length: 25 }, (_, i) => ({ ...mockTransactions.transactions[0], txn_id: i })) };
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=25')
      );
    });
  });

  it('handles year and month filters', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTags;
      return mockTransactions;
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByLabelText('Year')).toBeInTheDocument());

    const yearSelect = screen.getByLabelText('Year');
    fireEvent.change(yearSelect, { target: { value: '2023' } });

    await waitFor(() => {
      // Check last call
      const lastCall = apiFetch.mock.calls[apiFetch.mock.calls.length - 1][0];
      expect(lastCall).toContain('year=2023');
    });

    const monthSelect = screen.getByLabelText('Month');
    fireEvent.change(monthSelect, { target: { value: '10' } });

    await waitFor(() => {
      const lastCall = apiFetch.mock.calls[apiFetch.mock.calls.length - 1][0];
      expect(lastCall).toContain('month=2023-10');
    });
  });
});
