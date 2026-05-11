import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddTransactionPage } from './AddTransaction';
import { apiFetch } from '../../utils/apiClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/apiClient.js', () => ({
  apiFetch: vi.fn()
}));

// Mock AuthContext so component doesn't need a real AuthProvider
vi.mock('../../state/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { user_id: 1, currency: '$' } })
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
        { tag_id: 12, tag_name: 'Miscellaneous', parent: null, children: [] },
        { tag_id: 1, tag_name: 'Groceries', parent: null, children: [] }
      ]
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AddTransactionPage />
      </MemoryRouter>
    );

  it('renders form fields correctly', async () => {
    renderComponent();
    expect(screen.getByText('Add transaction')).toBeInTheDocument();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/tags'));
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('allows user to fill out the form and submit successfully', async () => {
    renderComponent();

    // Let tags load
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/tags'));

    apiFetch.mockResolvedValueOnce({
      transaction: { txn_id: 1, amount: 50.5 }
    });

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '50.50' } });
    fireEvent.change(screen.getByLabelText('Beneficiary'), { target: { value: 'Store' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'debit' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Test note' } });

    fireEvent.submit(screen.getByText('Add').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/transactions', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"amount":50.5')
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error if API fails', async () => {
    renderComponent();

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    apiFetch.mockRejectedValueOnce({ error: 'Server error' });

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '10' } });
    fireEvent.submit(screen.getByText('Add').closest('form'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
