import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiFetch } from '../../shared/api/apiClient';

import { AddTransactionPage } from './AddTransaction';

vi.mock('../../shared/api/apiClient', () => ({
  apiFetch: vi.fn(),
}));

// Mock AuthContext so component doesn't need a real AuthProvider
vi.mock('../../features/auth/state/useAuth', () => ({
  useAuth: () => ({ user: { user_id: 1, currency: '$' } }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AddTransactionPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('tags'))
        return {
          tags: [
            {
              tag_id: 12,
              tag_name: 'Miscellaneous',
              parent: null,
              children: [],
            },
            { tag_id: 1, tag_name: 'Groceries', parent: null, children: [] },
          ],
        };
      if (url.includes('beneficiaries')) return [];
      if (url.includes('constants')) return {};
      return {};
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AddTransactionPage />
      </MemoryRouter>
    );

  it('renders form fields correctly', async () => {
    renderComponent();
    expect(screen.getByText(/Add Transaction/i)).toBeInTheDocument();
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
      transaction: { txn_id: 1, amount: 50.5 },
    });

    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '50.50' },
    });
    fireEvent.change(screen.getByLabelText('Beneficiary'), {
      target: { value: 'Store' },
    });
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'debit' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Test note' },
    });

    fireEvent.submit(screen.getByText('Create Transaction').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/transactions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"amount":50.5'),
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/transactions');
    });
  });

  it('shows error if API fails', async () => {
    renderComponent();

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));

    apiFetch.mockRejectedValueOnce({ error: 'Server error' });

    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '10' },
    });
    fireEvent.submit(screen.getByText('Create Transaction').closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Failed to create/i)).toBeInTheDocument();
    });
  });
});
