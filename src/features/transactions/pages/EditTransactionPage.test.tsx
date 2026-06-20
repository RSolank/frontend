import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { EditTransactionPage } from './EditTransactionPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
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

function mountAt(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/transactions/:id/edit" element={<EditTransactionPage />} />
    </Routes>,
    { initialEntries: [`/transactions/${id}/edit`] }
  );
}

beforeEach(() => {
  mockNavigate.mockReset();
  server.use(
    http.get(`${API_BASE}/tags`, () => HttpResponse.json(mockTags)),
    http.get(`${API_BASE}/beneficiaries`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/metadata/constants`, () =>
      HttpResponse.json(mockConstants)
    )
  );
});

describe('EditTransactionPage', () => {
  it('renders not-found when transaction missing', async () => {
    server.use(
      http.get(`${API_BASE}/transactions/1`, () =>
        HttpResponse.json({ transaction: null })
      )
    );
    mountAt('1');
    await waitFor(() =>
      expect(screen.getByText('Transaction not found')).toBeInTheDocument()
    );
  });

  it('loads a manual transaction and updates it', async () => {
    server.use(
      http.get(`${API_BASE}/transactions/1`, () =>
        HttpResponse.json({
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
        })
      )
    );

    let patchedBody: unknown = null;
    server.use(
      http.patch(`${API_BASE}/transactions/1`, async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({ ok: true });
      })
    );

    mountAt('1');

    // Seamless-transition convention (Batch 9.8): inputs are always
    // rendered, no view-mode toggle. Wait for the loaded values to
    // appear directly in the form inputs.
    await waitFor(() => {
      expect(screen.getByDisplayValue('50.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Store')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });
    // Non-recurring txn → no recurring chip.
    expect(screen.queryByText('Recurring')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('50.5'), {
      target: { value: '60' },
    });
    const form = screen.getByText('Save Changes').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(patchedBody).toMatchObject({ amount: 60 });
      expect(mockNavigate).toHaveBeenCalledWith('/transactions');
    });
  });

  it('shows the recurring chip for a recurring instance', async () => {
    server.use(
      http.get(`${API_BASE}/transactions/7`, () =>
        HttpResponse.json({
          transaction: {
            txn_id: 7,
            amount: 1000,
            debit_credit: 'debit',
            beneficiary_name: 'Netflix',
            txn_date: '2023-10-10',
            tag_ids: [],
            source: 'statement',
            recurring_template_id: 5,
          },
        })
      )
    );
    mountAt('7');
    const chip = await screen.findByText('Recurring');
    // Links to the template, highlighted on the recurring page.
    expect(chip.closest('a')).toHaveAttribute(
      'href',
      '/recurring?template=5'
    );
  });

  it('restricts editable fields for statement-sourced rows', async () => {
    server.use(
      http.get(`${API_BASE}/transactions/2`, () =>
        HttpResponse.json({
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
        })
      )
    );

    let patchedBody: unknown = null;
    server.use(
      http.patch(`${API_BASE}/transactions/2`, async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({ ok: true });
      })
    );

    mountAt('2');

    // Per the Batch 9.8 DetailModal convention, the statement-locked
    // fields (beneficiary/amount/type/date) DO render in the modal —
    // they're just readOnly inputs. Clicking one surfaces the
    // LockedFieldBanner explaining the lock.
    await waitFor(() =>
      expect(screen.getByDisplayValue('Stmt Note')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Bank Transfer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();

    // Click a locked field — banner surfaces explaining the lock.
    fireEvent.click(screen.getByDisplayValue('Bank Transfer'));
    await screen.findByTestId('locked-field-banner');

    fireEvent.change(screen.getByDisplayValue('Stmt Note'), {
      target: { value: 'Updated' },
    });
    const form = screen.getByText('Save Changes').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(patchedBody).toEqual({ notes: 'Updated', tag_ids: [] });
    });
  });

  it('replaces Miscellaneous when a real tag is picked', async () => {
    server.use(
      http.get(`${API_BASE}/transactions/1`, () =>
        HttpResponse.json({
          transaction: {
            txn_id: 1,
            amount: 10,
            debit_credit: 'debit',
            beneficiary_name: 'Store',
            beneficiary: 'Store',
            txn_date: '2023-10-10',
            notes: '',
            tag_ids: [2], // Misc
            source: 'manual',
          },
        })
      )
    );

    mountAt('1');

    await waitFor(() =>
      expect(screen.getByText('Miscellaneous')).toBeInTheDocument()
    );

    fireEvent.focus(screen.getByPlaceholderText('Search tags...'));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Groceries' }));

    await waitFor(() =>
      expect(screen.queryByText('Miscellaneous')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
