import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddTransactionPage } from './AddTransaction';
import { apiFetch } from '../utils/apiClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/apiClient.js', () => ({
  apiFetch: vi.fn()
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('AddTransactionPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for tags fetch
    apiFetch.mockResolvedValueOnce({
      tags: [
        { tag_id: 12, name: 'Miscellaneous', parent: null },
        { tag_id: 1, name: 'Groceries', parent: null }
      ]
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AddTransactionPage />
      </MemoryRouter>
    );

  it('renders form fields correctly', async () => {
    renderComponent();
    expect(screen.getByText('Add transaction')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Merchant')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('allows user to fill out the form and submit successfully', async () => {
    renderComponent();

    // The first call to apiFetch was for tags in useEffect
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/tags');
    });

    apiFetch.mockResolvedValueOnce({
      transaction: { txn_id: 1, amount: 50.5 }
    });

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50.50' } });
    fireEvent.change(screen.getByLabelText('Merchant'), { target: { value: 'Store' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'debit' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Test note' } });

    fireEvent.submit(screen.getByText('Add').closest('form'));

    // Verify it called submit
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
      expect(apiFetch).toHaveBeenLastCalledWith('/api/transactions', {
        method: 'POST',
        body: expect.stringContaining('"amount":50.5')
      });
      // Check if navigated home
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error if API fails', async () => {
    renderComponent();

    // Let tags load
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    apiFetch.mockRejectedValueOnce({ error: 'Server error' });

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } });
    fireEvent.submit(screen.getByText('Add').closest('form'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
