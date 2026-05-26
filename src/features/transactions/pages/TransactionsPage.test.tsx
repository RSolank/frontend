import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/server';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { usePreferencesStore } from '../../../shared/state/preferences.store';

import { TransactionsPage } from './TransactionsPage';

const tagsResponse = {
  tags: [
    {
      tag_id: 10,
      tag_name: 'Food',
      parent: null,
      tag_type: 'discretionary',
      aliases: [],
      created_by: null,
      children: [],
    },
    {
      tag_id: 20,
      tag_name: 'Income',
      parent: null,
      tag_type: 'income',
      aliases: [],
      created_by: null,
      children: [],
    },
  ],
};

const txnList = {
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

const fullPage = {
  transactions: Array.from({ length: 25 }, (_, i) => ({
    ...txnList.transactions[0],
    txn_id: i + 100,
  })),
  returned_count: 25,
};

const nextPage = {
  transactions: [{ ...txnList.transactions[0], txn_id: 999 }],
  returned_count: 1,
};

const merchantGroups = {
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

describe('TransactionsPage', () => {
  beforeEach(() => {
    usePreferencesStore.getState().setPreferences({
      currency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    });
    server.use(
      http.get('http://localhost:4000/api/tags', () =>
        HttpResponse.json(tagsResponse)
      ),
      http.get('http://localhost:4000/api/metadata/currencies', () =>
        HttpResponse.json({
          currencies: [
            { code: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
            { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
          ],
        })
      )
    );
  });

  function mountWithList(list: object = txnList) {
    server.use(
      http.get('http://localhost:4000/api/transactions', () =>
        HttpResponse.json(list)
      )
    );
    return renderWithProviders(<TransactionsPage />);
  }

  it('renders transactions table with tags and links', async () => {
    mountWithList();

    await waitFor(() => {
      expect(screen.getByText('Supermarket')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Food').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    // Beneficiaries + Dashboard header buttons were removed in the
    // Batch 6.5 follow-up (TopNav owns those now). The row-level
    // beneficiary link still navigates to /beneficiaries/<uid>, which
    // is itself a redirect into ?edit=<uid> on the list page.
    expect(screen.getByRole('link', { name: 'Supermarket' })).toHaveAttribute(
      'href',
      '/beneficiaries/10'
    );
  });

  it('shows action dropdown only for manual transactions', async () => {
    mountWithList();

    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    const toggleButtons = screen.getAllByRole('button', {
      name: 'More actions',
    });
    expect(toggleButtons).toHaveLength(1);

    const salaryRow = screen.getByText('Salary').closest('tr');
    expect(salaryRow).not.toBeNull();
    expect(
      within(salaryRow as HTMLElement).queryByRole('button', {
        name: 'More actions',
      })
    ).toBeNull();
  });

  it('handles pagination', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.get('http://localhost:4000/api/transactions', ({ request }) => {
        capturedUrls.push(request.url);
        const url = new URL(request.url);
        if (url.searchParams.get('offset') === '25') {
          return HttpResponse.json(nextPage);
        }
        return HttpResponse.json(fullPage);
      })
    );

    renderWithProviders(<TransactionsPage />);

    await waitFor(() =>
      expect(screen.getByText('Next')).not.toBeDisabled()
    );

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(capturedUrls.some((u) => u.includes('offset=25'))).toBe(true);
    });
  });

  it('merchant view links to beneficiary and Details filters by beneficiary_id', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.get('http://localhost:4000/api/transactions', ({ request }) => {
        capturedUrls.push(request.url);
        const url = new URL(request.url);
        if (url.searchParams.get('group_by') === 'merchant') {
          return HttpResponse.json(merchantGroups);
        }
        if (url.searchParams.get('beneficiary_id') === '42') {
          return HttpResponse.json({
            transactions: [{ ...txnList.transactions[0], txn_id: 99 }],
            returned_count: 1,
          });
        }
        return HttpResponse.json(txnList);
      })
    );

    renderWithProviders(<TransactionsPage />);

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
      expect(capturedUrls.some((u) => u.includes('beneficiary_id=42'))).toBe(
        true
      );
    });
  });

  it('deletes manual transactions via dropdown', async () => {
    let deleted = false;
    server.use(
      http.get('http://localhost:4000/api/transactions', () =>
        HttpResponse.json(txnList)
      ),
      http.delete('http://localhost:4000/api/transactions/1', () => {
        deleted = true;
        return HttpResponse.json({ ok: true });
      })
    );

    renderWithProviders(<TransactionsPage />);

    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Batch 6.5: delete now opens a ConfirmDialog instead of
    // window.confirm. The "Delete" button inside the dialog drives
    // the API call.
    const dialog = await screen.findByRole('dialog', {
      name: /Delete transaction/i,
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });
});
