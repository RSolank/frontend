import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { TaxTrackerPage } from './TaxTrackerPage';

const billsResponse = {
  bills: [
    {
      bill_id: 101,
      period_start: '2026-02-15',
      period_end: '2026-02-21',
      status: 'pending',
      amount: 87.5,
    },
    {
      bill_id: 102,
      period_start: '2026-02-08',
      period_end: '2026-02-14',
      status: 'paid',
      amount: 42.0,
    },
  ],
};

const billDetailResponse = {
  bill_id: 101,
  period_start: '2026-02-15',
  period_end: '2026-02-21',
  status: 'pending',
  amount: 87.5,
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
    http.get('http://localhost:4000/api/consumption-tax/bills', () =>
      HttpResponse.json(billsResponse)
    ),
    http.get('http://localhost:4000/api/consumption-tax/bills/101', () =>
      HttpResponse.json(billDetailResponse)
    ),
    http.get(
      'http://localhost:4000/api/consumption-tax/tracker/current-week',
      () => new HttpResponse(null, { status: 404 })
    ),
    http.get('http://localhost:4000/api/metadata/currencies', () =>
      HttpResponse.json({
        currencies: [
          { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
        ],
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
    installHandlers();
  });

  it('renders the bills list with dd/mon/yyyy dates, status pills, and money', async () => {
    renderWithProviders(<TaxTrackerPage />);

    await waitFor(() =>
      expect(screen.getByTestId('bill-row-101')).toBeInTheDocument()
    );

    const pending = screen.getByTestId('bill-row-101');
    // dd/Mon/yyyy default per the 2026-05-26 lock.
    expect(pending).toHaveTextContent('15/Feb/2026');
    expect(pending).toHaveTextContent('21/Feb/2026');
    expect(pending).toHaveTextContent('pending');
    expect(pending).toHaveTextContent('$87.50');

    // Action cluster: View + Pay on the same line for pending bills.
    expect(
      within(pending).getByRole('button', { name: /View/ })
    ).toBeInTheDocument();
    expect(
      within(pending).getByRole('button', { name: /^Pay$/ })
    ).toBeInTheDocument();

    // Paid bills only have a View action.
    const paid = screen.getByTestId('bill-row-102');
    expect(
      within(paid).queryByRole('button', { name: /^Pay$/ })
    ).not.toBeInTheDocument();
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

    // Pay button mirrored into the modal footer for pending bills.
    expect(screen.getByTestId('bill-modal-pay')).toBeInTheDocument();
  });

  it('renders the running tracker when the endpoint returns data', async () => {
    server.use(
      http.get(
        'http://localhost:4000/api/consumption-tax/tracker/current-week',
        () =>
          HttpResponse.json({
            period_start: '2026-03-01',
            period_end: '2026-03-07',
            running_tax: 12.5,
            running_penalty: 2.0,
            projected_tax: 25.0,
            projected_penalty: 4.0,
            per_tag: [
              {
                tag_id: 33,
                tag_name: 'Dining',
                txn_type: 'discretionary',
                tax_amount: 8.0,
                penalty: 1.5,
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
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });
});
