import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiFetch } from '../../shared/api/apiClient';

import { EditTransactionPage } from './EditTransaction';

vi.mock('../../shared/api/apiClient', () => ({
  apiFetch: vi.fn(),
}));

// Mock AuthContext so component doesn't need a real AuthProvider
vi.mock('../../state/AuthContext.jsx', () => ({
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

describe('EditTransactionPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (id = '1') =>
    render(
      <MemoryRouter
        initialEntries={[`/edit/${id}`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/edit/:id" element={<EditTransactionPage />} />
        </Routes>
      </MemoryRouter>
    );

  const mockConstants = {
    TOTAL_TAG_ID: 1,
    MISCELLANEOUS_TAG_ID: 2,
  };

  const mockTags = [
    { tag_id: 2, tag_name: 'Miscellaneous' },
    { tag_id: 3, tag_name: 'Groceries' },
  ];

  it('renders loading initially and handles not found', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/api/transactions'))
        return Promise.resolve({ transaction: null });
      if (url === '/api/tags') return Promise.resolve({ tags: [] });
      if (url === '/api/beneficiaries') return Promise.resolve([]);
      if (url === '/api/metadata/constants')
        return Promise.resolve(mockConstants);
      return Promise.resolve({});
    });

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
            beneficiary_name: 'Store',
            beneficiary: 'Store',
            txn_date: '2023-10-10',
            notes: 'Test',
            tag_ids: [3],
            source: 'manual',
          },
        };
      }
      if (url === '/api/tags') {
        return { tags: mockTags };
      }
      if (url === '/api/beneficiaries') {
        return [];
      }
      if (url === '/api/metadata/constants') {
        return mockConstants;
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue('50.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Store')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    // Update form
    fireEvent.change(screen.getByDisplayValue('50.5'), {
      target: { value: '60' },
    });
    fireEvent.submit(screen.getByText('Save Changes').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/transactions/1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"amount":60'),
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/transactions');
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
            beneficiary_name: 'Bank Transfer',
            beneficiary: 'Bank Transfer',
            txn_date: '2023-10-11',
            notes: 'Stmt Note',
            tag_ids: [],
            source: 'statement',
          },
        };
      }
      if (url === '/api/tags') return { tags: mockTags };
      if (url === '/api/beneficiaries') return [];
      if (url === '/api/metadata/constants') return mockConstants;
      return {};
    });

    renderComponent('2');

    await waitFor(() => {
      expect(screen.getByText(/Edit Transaction/i)).toBeInTheDocument();
    });

    // These fields should NOT exist for statement source (amount field with specific text)
    expect(screen.queryByText(/Amount/)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Stmt Note')).toBeInTheDocument();

    // Only notes and tags are submitted
    fireEvent.change(screen.getByDisplayValue('Stmt Note'), {
      target: { value: 'Updated Stmt Note' },
    });
    fireEvent.submit(screen.getByText('Save Changes').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/transactions/2',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ notes: 'Updated Stmt Note', tag_ids: [] }),
        })
      );
    });
  });

  it('removes Miscellaneous when adding a real tag', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.includes('/api/transactions/1')) {
        return {
          transaction: {
            txn_id: 1,
            tag_ids: [2], // Starts with Misc
            source: 'manual',
          },
        };
      }
      if (url === '/api/tags') return { tags: mockTags };
      if (url === '/api/beneficiaries') return [];
      if (url === '/api/metadata/constants') return mockConstants;
      return {};
    });

    renderComponent();
    await waitFor(() =>
      expect(screen.getByText('Miscellaneous')).toBeInTheDocument()
    );

    // Focus search and pick Groceries (tag_id 3)
    const search = screen.getByPlaceholderText('Search tags...');
    fireEvent.focus(search);

    const groceriesOption = screen.getByText('Groceries');
    fireEvent.mouseDown(groceriesOption); // OnMouseDown is what we used

    // Misc should be gone, Groceries should be there
    expect(screen.queryByText('Miscellaneous')).not.toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
