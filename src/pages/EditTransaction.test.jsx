import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EditTransactionPage } from './EditTransaction';
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

describe('EditTransactionPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (id = '1') =>
    render(
      <MemoryRouter initialEntries={[`/edit/${id}`]}>
        <Routes>
          <Route path="/edit/:id" element={<EditTransactionPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders loading initially and handles not found', async () => {
    apiFetch.mockResolvedValueOnce({ transaction: null }); // For txn
    apiFetch.mockResolvedValueOnce({ tags: [] }); // For tags

    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Transaction not found')).toBeInTheDocument();
    });
  });

  it('loads and displays a manual transaction for full editing', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('/api/transactions/1')) {
        return {
          transaction: {
            txn_id: 1,
            amount: 50.5,
            debit_credit: 'debit',
            merchant: 'Store',
            txn_date: '2023-10-10',
            notes: 'Test',
            tag_ids: [1],
            source: 'manual'
          }
        };
      }
      if (url === '/api/tags') {
        return { tags: [{ tag_id: 1, tag_name: 'Groceries', parent: null }] };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText('Amount')).toHaveValue(50.5);
      expect(screen.getByLabelText('Merchant')).toHaveValue('Store');
    });

    // Update form
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '60' } });
    fireEvent.submit(screen.getByText('Save').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/transactions/1', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"amount":60')
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('restricts edit fields for statement transactions', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('/api/transactions/2')) {
        return {
          transaction: {
            txn_id: 2,
            amount: 100,
            debit_credit: 'debit',
            merchant: 'Bank Transfer',
            txn_date: '2023-10-11',
            notes: 'Stmt Note',
            tag_ids: [],
            source: 'statement'
          }
        };
      }
      return { tags: [] };
    });

    renderComponent('2');

    await waitFor(() => {
      expect(screen.getByText('Edit transaction')).toBeInTheDocument();
    });

    // These fields should NOT exist for statement source
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Merchant')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('Stmt Note');

    // Only notes and tags are submitted
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Updated Stmt Note' } });
    fireEvent.submit(screen.getByText('Save').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/transactions/2', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Updated Stmt Note', tag_ids: [] })
      }));
    });
  });
});
