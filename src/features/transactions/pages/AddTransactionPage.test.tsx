import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/server';
import { renderWithProviders } from '../../../test/renderWithProviders';

import { AddTransactionPage } from './AddTransactionPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTags = {
  tags: [
    {
      tag_id: 2,
      tag_name: 'Miscellaneous',
      parent: null,
      tag_type: 'discretionary',
      aliases: [],
      created_by: null,
      children: [],
    },
    {
      tag_id: 3,
      tag_name: 'Groceries',
      parent: null,
      tag_type: 'essential',
      aliases: [],
      created_by: null,
      children: [],
    },
  ],
};

const mockConstants = {
  TOTAL_TAG_ID: 1,
  MISCELLANEOUS_TAG_ID: 2,
  CONSUMPTION_TAX_TAG_ID: 3,
};

beforeEach(() => {
  mockNavigate.mockReset();
  server.use(
    http.get('http://localhost:4000/api/tags', () =>
      HttpResponse.json(mockTags)
    ),
    http.get('http://localhost:4000/api/beneficiaries', () =>
      HttpResponse.json([])
    ),
    http.get('http://localhost:4000/api/metadata/constants', () =>
      HttpResponse.json(mockConstants)
    )
  );
});

describe('AddTransactionPage', () => {
  it('renders form fields', async () => {
    renderWithProviders(<AddTransactionPage />);
    expect(screen.getByText(/Add Transaction/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('submits the form successfully and navigates', async () => {
    let body: unknown = null;
    server.use(
      http.post('http://localhost:4000/api/transactions', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ transaction: { txn_id: 1, amount: 50.5 } });
      })
    );

    renderWithProviders(<AddTransactionPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '50.50' },
    });
    fireEvent.change(screen.getByLabelText('Beneficiary'), {
      target: { value: 'Store' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Test note' },
    });

    const form = screen.getByText('Create Transaction').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(body).toMatchObject({
        amount: 50.5,
        beneficiary_name: 'Store',
        notes: 'Test note',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/transactions');
    });
  });

  it('shows an error when the create call fails', async () => {
    server.use(
      http.post('http://localhost:4000/api/transactions', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    );

    renderWithProviders(<AddTransactionPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Beneficiary'), {
      target: { value: 'Store' },
    });

    const form = screen.getByText('Create Transaction').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument();
    });
  });
});
