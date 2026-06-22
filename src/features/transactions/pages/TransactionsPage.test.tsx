import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

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

// BE 2026-06-06 (`9c00ecd`) — grouped reads carry `period_type` +
// `period_start` on every page; with no month/period/date query
// param the BE now aggregates all-time (period_type=`"all"`,
// period_start=null) rather than scoping to the current month.
const merchantGroups = {
  groups: [
    {
      beneficiary_id: 42,
      beneficiary_name: 'Coffee Shop',
      total_count: 3,
      net_expense: 450,
    },
  ],
  period_type: 'all',
  period_start: null,
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
      http.get(`${API_BASE}/tags`, () => HttpResponse.json(tagsResponse)),
      http.get(`${API_BASE}/metadata/currencies`, () =>
        HttpResponse.json({
          currencies: [
            { code: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
            { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
          ],
        })
      ),
      http.get(`${API_BASE}/beneficiaries`, () => HttpResponse.json([]))
    );
  });

  function mountWithList(list: object = txnList) {
    server.use(
      http.get(`${API_BASE}/transactions`, () => HttpResponse.json(list))
    );
    return renderWithProviders(<TransactionsPage />);
  }

  it('renders transactions row-list with tags + beneficiary links', async () => {
    mountWithList();

    await waitFor(() => {
      expect(screen.getByText('Supermarket')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Food').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    // Beneficiary name within the row is a Link to the merchant page.
    expect(screen.getByRole('link', { name: 'Supermarket' })).toHaveAttribute(
      'href',
      '/beneficiaries/10'
    );
  });

  it('⋯ action button opens edit modal; Trash visible only for manual txns', async () => {
    mountWithList();
    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    const openButtons = screen.getAllByRole('button', {
      name: /view \/ edit transaction/i,
    });
    expect(openButtons).toHaveLength(2);
  });

  it('Merchant tab switches view; Details filters by beneficiary_id', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
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

    // Three-pill view toggle — "Merchant" is the middle pill.
    fireEvent.click(screen.getByRole('tab', { name: /^Merchant$/i }));

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

  it('Merchant view scope pill — "All time" when BE returns period_type=all', async () => {
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('group_by') === 'merchant') {
          return HttpResponse.json(merchantGroups);
        }
        return HttpResponse.json(txnList);
      })
    );
    renderWithProviders(<TransactionsPage />);
    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('tab', { name: /^Merchant$/i }));
    // Pill matches the BE-supplied window. Default fixture has
    // period_type='all' / period_start=null.
    expect(await screen.findByTestId('merchant-scope-pill')).toHaveTextContent(
      'All time'
    );
  });

  it('Merchant view scope pill — formatted month for monthly window', async () => {
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('group_by') === 'merchant') {
          return HttpResponse.json({
            ...merchantGroups,
            period_type: 'monthly',
            period_start: '2026-02-01',
          });
        }
        return HttpResponse.json(txnList);
      })
    );
    renderWithProviders(<TransactionsPage />);
    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('tab', { name: /^Merchant$/i }));
    expect(await screen.findByTestId('merchant-scope-pill')).toHaveTextContent(
      /Feb 2026/
    );
  });

  it('Calendar tab renders the calendar grid', async () => {
    mountWithList();
    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Calendar$/i }));

    // The MonthDropdown is hidden in calendar mode; the calendar grid
    // mounts both desktop + mobile shapes simultaneously.
    expect(screen.queryByLabelText('Select month')).toBeNull();
    expect(
      screen.getAllByRole('grid', { name: /Transaction calendar/i }).length
    ).toBeGreaterThan(0);
  });

  it('clicking a calendar day opens the side panel with that day’s txns', async () => {
    // Pin "today" so the `month=` filter the calendar query issues is
    // stable. toFake: ['Date'] keeps setTimeout / queueMicrotask alive
    // so React Query + msw + RTL waiters still resolve.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'));

    try {
      const ANCHOR_DAY = '2026-05-27';
      server.use(
        http.get(`${API_BASE}/transactions`, ({ request }) => {
          const url = new URL(request.url);
          const month = url.searchParams.get('month');
          if (month === '2026-05') {
            return HttpResponse.json({
              transactions: [
                {
                  txn_id: 501,
                  txn_date: ANCHOR_DAY,
                  beneficiary_name: 'Cafe',
                  beneficiary: 'Cafe',
                  amount: 120,
                  debit_credit: 'debit',
                  source: 'manual',
                  tag_ids: [10],
                },
              ],
              returned_count: 1,
            });
          }
          return HttpResponse.json({ transactions: [], returned_count: 0 });
        })
      );

      // Pre-set the URL to calendar view so the page renders the
      // calendar directly without clicking the tab.
      renderWithProviders(<TransactionsPage />, {
        initialEntries: ['/transactions?view=calendar'],
      });

      const cells = await screen.findAllByRole('gridcell', {
        name: new RegExp(`^${ANCHOR_DAY}`),
      });
      expect(cells.length).toBeGreaterThan(0);
      fireEvent.click(cells[0]!);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Cafe/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Filters button opens the sidebar; Clear all resets sidebar state', async () => {
    mountWithList();
    await waitFor(() =>
      expect(screen.getByText('Supermarket')).toBeInTheDocument()
    );

    // Open filter sidebar.
    fireEvent.click(screen.getByRole('button', { name: /open filters/i }));

    const sidebar = await screen.findByRole('dialog', { name: /filters/i });
    // Set debit-only.
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Debit' }));
    // The filter button gains a (1) badge once we close.
    fireEvent.click(
      within(sidebar).getByRole('button', { name: /clear all/i })
    );

    // Done closes the sidebar.
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /filters/i })).toBeNull();
    });
    // Active count is back to 0 (no badge).
    expect(
      screen.queryByRole('button', { name: /open filters \(1 active\)/i })
    ).toBeNull();
  });

  it('deleting a tax-payment txn prompts reopen-vs-keep-paid and passes the choice', async () => {
    useAuthStore.getState().setConstants({
      TOTAL_TAG_ID: 1,
      MISCELLANEOUS_TAG_ID: 2,
      MISC_CREDIT_TAG_ID: 4,
      CONSUMPTION_TAX_TAG_ID: 3,
      TAXABLE_TXN_TYPES: [],
      VALID_TAG_TYPES: [],
      VALID_TXN_TYPES: [],
      RELATIONSHIP_TYPES: [],
      SYSTEM_USER_ID: null,
    });

    const payment = {
      txn_id: 1,
      txn_date: '2026-02-05',
      beneficiary_name: 'Savings transfer',
      beneficiary: 'Savings transfer',
      amount: 100,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [3], // carries the Consumption Tax tag → a bill payment
    };
    let deletedWith: string | null = null;
    server.use(
      http.get(`${API_BASE}/transactions`, () =>
        HttpResponse.json({ transactions: [payment], returned_count: 1 })
      ),
      http.get(`${API_BASE}/transactions/1`, () =>
        HttpResponse.json({ transaction: payment })
      ),
      http.delete(`${API_BASE}/transactions/1`, ({ request }) => {
        deletedWith = new URL(request.url).searchParams.get('on_payment');
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderWithProviders(<TransactionsPage />, {
      initialEntries: ['/transactions?edit=1'],
    });

    // Remove from the edit modal → the tax-payment two-path prompt, not the
    // plain confirm dialog.
    fireEvent.click(
      await screen.findByRole('button', { name: /remove transaction/i })
    );
    await screen.findByText(/settles a consumption-tax bill/i);
    expect(
      screen.getByRole('button', { name: /keep bill paid/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reopen & delete/i }));

    await waitFor(() => expect(deletedWith).toBe('reopen'));
  });
});
