import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { useTaxModeStore } from '../../../shared/state/taxMode.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { TaxTrackerPage } from './TaxTrackerPage';

const billsResponse = {
  bills: [
    {
      bill_id: 101,
      period_start: '2026-02-15',
      period_end: '2026-02-21',
      status: 'BILLED',
      amount: 87.5,
      amount_paid: 0,
    },
    {
      bill_id: 102,
      period_start: '2026-02-08',
      period_end: '2026-02-14',
      status: 'PAID',
      amount: 42.0,
      amount_paid: 42.0,
    },
  ],
};

const billDetailResponse = {
  bill_id: 101,
  period_start: '2026-02-15',
  period_end: '2026-02-21',
  status: 'BILLED',
  amount: 87.5,
  amount_paid: 0,
  totals: { tax_total: 72.5, penalty_total: 15.0 },
  items: [
    {
      txn_id: 5001,
      date: '2026-02-17',
      beneficiary: 'BigBox',
      txn_type: 'discretionary',
      amount: 250.0,
      debit_credit: 'debit',
      tax_amount: 50.0,
      penalty: 10.0,
      penalty_tag_id: 33,
      penalty_tag_name: 'Eating Out',
    },
    {
      txn_id: 5002,
      date: '2026-02-19',
      beneficiary: 'Cafe',
      txn_type: 'discretionary',
      amount: 112.5,
      debit_credit: 'debit',
      tax_amount: 22.5,
      penalty: 5.0,
      penalty_tag_id: 33,
      penalty_tag_name: 'Eating Out',
    },
  ],
};

function installHandlers() {
  server.use(
    http.get(`${API_BASE}/consumption-tax/bills`, () =>
      HttpResponse.json(billsResponse)
    ),
    http.get(`${API_BASE}/consumption-tax/bills/101`, () =>
      HttpResponse.json(billDetailResponse)
    ),
    // `/tracker/current-week` is gone — the FE now derives the
    // running tracker from the ACCRUING bill (see
    // `useTrackerCurrentWeekQuery` in
    // `features/taxation/api/queries.ts`). No MSW stub needed for
    // the deleted route.
    http.get(`${API_BASE}/metadata/currencies`, () =>
      HttpResponse.json({
        currencies: [{ code: 'USD', label: 'USD - US Dollar', symbol: '$' }],
      })
    )
  );
}

describe('TaxTrackerPage', () => {
  beforeEach(() => {
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
    useTaxModeStore.setState({ mode: 'auto' });
    installHandlers();
  });
  afterEach(() => {
    useTaxModeStore.setState({ mode: 'auto' });
  });

  it('renders the bills list with dd/mon/yyyy dates, BE Phase 2.6 status pills, and money', async () => {
    renderWithProviders(<TaxTrackerPage />);

    await waitFor(() =>
      expect(screen.getByTestId('bill-row-101')).toBeInTheDocument()
    );

    const billed = screen.getByTestId('bill-row-101');
    // dd/Mon/yyyy default per the 2026-05-26 lock.
    expect(billed).toHaveTextContent('15/Feb/2026');
    expect(billed).toHaveTextContent('21/Feb/2026');
    expect(
      within(billed).getByTestId('bill-status-BILLED')
    ).toBeInTheDocument();
    expect(billed).toHaveTextContent('$87.50');

    // Action cluster: View + Mark paid on the same line for BILLED bills.
    expect(
      within(billed).getByRole('button', { name: /View/ })
    ).toBeInTheDocument();
    expect(
      within(billed).getByRole('button', { name: /^Mark paid$/ })
    ).toBeInTheDocument();

    // PAID bills get a Reopen (mark-unpaid) affordance instead.
    const paid = screen.getByTestId('bill-row-102');
    expect(within(paid).getByTestId('bill-status-PAID')).toBeInTheDocument();
    expect(
      within(paid).queryByRole('button', { name: /^Mark paid$/ })
    ).not.toBeInTheDocument();
    expect(
      within(paid).getByRole('button', { name: /^Reopen$/ })
    ).toBeInTheDocument();
  });

  it('Generate / refresh bills lives at the top of the page and opens a modal', async () => {
    renderWithProviders(<TaxTrackerPage />);

    const trigger = await screen.findByTestId('generate-bills-button');
    fireEvent.click(trigger);

    // Modal shows the picker mode + date input.
    expect(
      await screen.findByRole('dialog', { name: /Generate bills/ })
    ).toBeInTheDocument();
    expect(screen.getByTestId('generate-week-input')).toBeInTheDocument();

    // Closing the modal doesn't blow up.
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Generate bills/ })
      ).not.toBeInTheDocument()
    );
  });

  it('hides the Generate button in off mode (taxation disabled)', async () => {
    useTaxModeStore.setState({ mode: 'off' });
    renderWithProviders(<TaxTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bill-row-101')).toBeInTheDocument()
    );
    expect(
      screen.queryByTestId('generate-bills-button')
    ).not.toBeInTheDocument();
  });

  it('flashes the Generate button when deep-linked with ?highlight=generate-bills', async () => {
    renderWithProviders(<TaxTrackerPage />, {
      initialEntries: ['/consumption-tax?highlight=generate-bills'],
    });
    const btn = await screen.findByTestId('generate-bills-button');
    // useDeepLinkHighlight fires post-mount → the shared highlight pulse class.
    await waitFor(() => expect(btn).toHaveClass('highlight-pulse'));
  });

  it('opens the bill detail modal, shows the Amount column, and exposes Pay inside the modal', async () => {
    renderWithProviders(<TaxTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bill-row-101')).toBeInTheDocument()
    );

    fireEvent.click(
      within(screen.getByTestId('bill-row-101')).getByRole('button', {
        name: /View/,
      })
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Bill — 15\/Feb\/2026 → 21\/Feb\/2026/)
      ).toBeInTheDocument()
    );

    // Amount column header + per-row values (250 + 112.50).
    expect(
      screen.getByRole('columnheader', { name: 'Amount' })
    ).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('$112.50')).toBeInTheDocument();

    // Mark-paid button mirrored into the modal footer for BILLED bills.
    expect(screen.getByTestId('bill-modal-mark-paid')).toBeInTheDocument();
  });

  it('mark-paid in the modal POSTs to the new endpoint and closes', async () => {
    const seenUrls: string[] = [];
    server.use(
      http.post(
        `${API_BASE}/consumption-tax/bills/:billId/mark-paid`,
        ({ request, params }) => {
          seenUrls.push(request.url);
          return HttpResponse.json({
            status: 'PAID',
            bill_id: Number(params.billId),
            amount_paid: 87.5,
          });
        }
      )
    );

    renderWithProviders(<TaxTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bill-row-101')).toBeInTheDocument()
    );

    // Open the detail modal and click Mark paid in the footer.
    fireEvent.click(
      within(screen.getByTestId('bill-row-101')).getByRole('button', {
        name: /View/,
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId('bill-modal-mark-paid')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('bill-modal-mark-paid'));

    // ConfirmDialog opens; click Mark paid to confirm.
    const confirm = await screen.findByRole('dialog', {
      name: /Mark bill as paid/i,
    });
    fireEvent.click(within(confirm).getByRole('button', { name: /Mark paid/ }));

    await waitFor(() =>
      expect(seenUrls.some((u) => u.endsWith('/bills/101/mark-paid'))).toBe(
        true
      )
    );
  });

  async function openBillWithAdjustments(...extra: Record<string, unknown>[]) {
    server.use(
      http.get(`${API_BASE}/consumption-tax/bills/101`, () =>
        HttpResponse.json({
          ...billDetailResponse,
          items: [...billDetailResponse.items, ...extra],
        })
      )
    );
    renderWithProviders(<TaxTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bill-row-101')).toBeInTheDocument()
    );
    fireEvent.click(
      within(screen.getByTestId('bill-row-101')).getByRole('button', {
        name: /View/,
      })
    );
    return screen.findByTestId('bill-adjustments');
  }

  const openBillWithAdjustment = (item: Record<string, unknown>) =>
    openBillWithAdjustments(item);

  // A recat correction on a given source bill, uniquely labelled for assertions.
  const mkAdj = (billId: number, idx: number) => ({
    txn_id: null,
    date: '2026-02-20',
    beneficiary: `Txn ${billId}-${idx}`,
    txn_type: 'discretionary',
    amount: 100,
    debit_credit: 'debit',
    tax_amount: 5.0,
    penalty: 0,
    is_adjustment: true,
    adjustment_for_bill_id: billId,
    diff: {
      before: { amount: 100, txn_type: 'essential', applied_rate: 0.05, tax_amount: 5, tags: [{ tag_id: 81, name: 'Groceries' }] },
      after: { amount: 100, txn_type: 'discretionary', applied_rate: 0.1, tax_amount: 10, tags: [{ tag_id: 80, name: 'Food' }] },
      txn_alive: true,
      added_tags: [{ tag_id: 80, name: 'Food' }],
      removed_tags: [{ tag_id: 81, name: 'Groceries' }],
    },
  });

  it('renders a recategorization as a change-driven diff (only changed fields + tag drift)', async () => {
    const adj = await openBillWithAdjustment({
      txn_id: null,
      date: '2026-02-20',
      beneficiary: 'Cafe Aroma',
      txn_type: 'discretionary',
      amount: 100,
      debit_credit: 'debit',
      tax_amount: 5.0,
      penalty: 0,
      is_adjustment: true,
      adjustment_for_bill_id: 95,
      diff: {
        before: { amount: 100, txn_type: 'essential', applied_rate: 0.05, tax_amount: 5, tags: [{ tag_id: 81, name: 'Groceries' }] },
        after: { amount: 100, txn_type: 'discretionary', applied_rate: 0.1, tax_amount: 10, tags: [{ tag_id: 80, name: 'Food' }] },
        txn_alive: true,
        added_tags: [{ tag_id: 80, name: 'Food' }],
        removed_tags: [{ tag_id: 81, name: 'Groceries' }],
      },
    });

    expect(adj).toHaveTextContent('Bill #95');
    expect(adj).toHaveTextContent('Cafe Aroma');
    expect(adj).toHaveTextContent('Recategorized');
    // Changed fields surface...
    expect(adj).toHaveTextContent('Essential');
    expect(adj).toHaveTextContent('Discretionary');
    expect(adj).toHaveTextContent('5%');
    expect(adj).toHaveTextContent('10%');
    expect(adj).toHaveTextContent('Food');
    expect(adj).toHaveTextContent('Groceries');
    // ...but the UNCHANGED amount is NOT rendered in the diff (change-driven).
    expect(adj).not.toHaveTextContent('Amount');
  });

  it('renders a deleted frozen-week txn as a removal (after → Removed)', async () => {
    const adj = await openBillWithAdjustment({
      txn_id: null,
      date: '2026-02-20',
      beneficiary: 'Gone Shop',
      txn_type: null,
      amount: 100,
      debit_credit: 'debit',
      tax_amount: -5.0,
      penalty: 0,
      is_adjustment: true,
      adjustment_for_bill_id: 95,
      diff: {
        before: { amount: 100, txn_type: 'essential', applied_rate: 0.05, tax_amount: 5, tags: [{ tag_id: 81, name: 'Groceries' }] },
        after: null,
        txn_alive: false,
        added_tags: [],
        removed_tags: [{ tag_id: 81, name: 'Groceries' }],
      },
    });

    expect(adj).toHaveTextContent('Gone Shop');
    expect(adj).toHaveTextContent('Deleted');
    expect(adj).toHaveTextContent('Removed');
    expect(adj).toHaveTextContent('Groceries');
  });

  it('collapses the whole section to one drill-down row when >3 bills are affected', async () => {
    const adj = await openBillWithAdjustments(
      mkAdj(91, 0),
      mkAdj(92, 0),
      mkAdj(93, 0),
      mkAdj(94, 0)
    );
    // Section collapsed: a summary row, no diff content yet.
    expect(adj).toHaveTextContent('4 bills');
    expect(screen.queryByText('Txn 91-0')).not.toBeInTheDocument();
    // Drill down → the per-bill groups (and their inline diffs) appear.
    fireEvent.click(screen.getByRole('button', { name: /4 bills/ }));
    expect(await screen.findByText('Txn 91-0')).toBeInTheDocument();
  });

  it('keeps the section open but collapses a busy bill (>3 corrections)', async () => {
    const adj = await openBillWithAdjustments(
      mkAdj(95, 0),
      mkAdj(95, 1),
      mkAdj(95, 2),
      mkAdj(95, 3)
    );
    // One bill, 4 corrections: section open (explainer visible), bill collapsed.
    expect(adj).toHaveTextContent('4 corrections');
    expect(screen.queryByText('Txn 95-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /4 corrections/ }));
    expect(await screen.findByText('Txn 95-0')).toBeInTheDocument();
  });

  it('collapses ALL bills together when one is busy (consistent siblings)', async () => {
    // 2 bills (≤3, so section open): one busy (4 corrections), one with a single
    // correction. The small bill collapses WITH the busy one — no sandwiched
    // odd-one-out — so its diff is hidden until drilled into.
    await openBillWithAdjustments(
      mkAdj(96, 0),
      mkAdj(96, 1),
      mkAdj(96, 2),
      mkAdj(96, 3),
      mkAdj(97, 0)
    );
    expect(screen.getByRole('button', { name: /4 corrections/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 correction/ })).toBeInTheDocument();
    // The lone-correction bill is collapsed too — its card not shown inline.
    expect(screen.queryByText('Txn 97-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /1 correction/ }));
    expect(await screen.findByText('Txn 97-0')).toBeInTheDocument();
  });

  it('derives the running tracker from the ACCRUING bill (per-tag + totals)', async () => {
    // Drop an ACCRUING bill into the list + provide its detail.
    // The FE finds it, fetches the detail, and reshapes items/totals
    // into the tracker view. Adjustment rows are excluded; penalties
    // bucket under their `penalty_tag_id` (so a "Dining" penalty
    // surfaces under "Dining" even when the spending row was tagged
    // differently).
    server.use(
      http.get(`${API_BASE}/consumption-tax/bills`, () =>
        HttpResponse.json({
          bills: [
            ...billsResponse.bills,
            {
              bill_id: 999,
              period_start: '2026-03-01',
              period_end: '2026-03-07',
              status: 'ACCRUING',
              amount: 14.5,
              amount_paid: 0,
            },
          ],
        })
      ),
      http.get(`${API_BASE}/consumption-tax/bills/999`, () =>
        HttpResponse.json({
          bill_id: 999,
          period_start: '2026-03-01',
          period_end: '2026-03-07',
          status: 'ACCRUING',
          amount: 14.5,
          amount_paid: 0,
          totals: { tax_total: 12.5, penalty_total: 2.0 },
          items: [
            {
              txn_id: 7001,
              date: '2026-03-02',
              beneficiary: 'Cafe',
              txn_type: 'discretionary',
              amount: 60,
              debit_credit: 'debit',
              tax_amount: 8.0,
              penalty: 1.5,
              tag_id: 33,
              tag_name: 'Dining',
              penalty_tag_id: 33,
              penalty_tag_name: 'Dining',
            },
            {
              txn_id: 7002,
              date: '2026-03-04',
              beneficiary: 'Bakery',
              txn_type: 'discretionary',
              amount: 25,
              debit_credit: 'debit',
              tax_amount: 4.5,
              penalty: 0.5,
              tag_id: 33,
              tag_name: 'Dining',
            },
          ],
        })
      )
    );

    renderWithProviders(<TaxTrackerPage />);

    await waitFor(() =>
      expect(screen.getByText(/Top contributors this week/)).toBeInTheDocument()
    );
    expect(screen.getByText('Dining')).toBeInTheDocument();
    // Accrued tax = totals.tax_total = $12.50.
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    // Accrued penalty = totals.penalty_total = $2.00.
    expect(screen.getByText('$2.00')).toBeInTheDocument();
  });

  it('renders the empty state when no ACCRUING bill exists (was a "Loading…" hang pre-2026-06-06)', async () => {
    renderWithProviders(<TaxTrackerPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/No tax accrued for this week yet/)
      ).toBeInTheDocument()
    );
    // The previously-stuck "Loading…" copy must not be on screen
    // after the bills query settles.
    expect(screen.queryByText(/^Loading…$/)).not.toBeInTheDocument();
  });
});
