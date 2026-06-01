import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import type { BankAccount } from '../api/schemas';

import { BankAccountsPage } from './BankAccountsPage';

function fixture(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    uid: 1,
    label: 'HDFC Savings',
    account_type: 'SAVINGS',
    is_committee_account: false,
    archived_at: null,
    identifiers: [],
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function withAccounts(rows: BankAccount[]) {
  server.use(
    http.get(`${API_BASE}/bank-accounts/`, () =>
      HttpResponse.json(rows)
    )
  );
}

describe('BankAccountsPage', () => {
  test('renders empty state when there are no accounts', async () => {
    withAccounts([]);
    renderWithProviders(<BankAccountsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bank-accounts-empty')).toBeInTheDocument()
    );
  });

  test('lists accounts with type pill and tax-pot badge when set', async () => {
    withAccounts([
      fixture({ uid: 1, label: 'HDFC', account_type: 'REGULAR' }),
      fixture({
        uid: 2,
        label: 'ICICI tax-pot',
        account_type: 'SAVINGS',
        is_committee_account: true,
        identifiers: [{ uid: 99, identifier: 'tax@upi', identifier_type: 'UPI' }],
      }),
    ]);
    renderWithProviders(<BankAccountsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bank-account-row-1')).toBeInTheDocument()
    );
    expect(screen.getByTestId('bank-account-row-2')).toHaveTextContent('ICICI tax-pot');
    expect(screen.getByTestId('bank-account-committee-badge-2')).toBeInTheDocument();
    expect(screen.queryByTestId('bank-account-committee-badge-1')).toBeNull();
    expect(screen.getByText('tax@upi')).toBeInTheDocument();
  });

  test('Add button opens the create modal', async () => {
    withAccounts([]);
    renderWithProviders(<BankAccountsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bank-accounts-empty')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('bank-account-add'));
    expect(screen.getByTestId('bank-account-label')).toBeInTheDocument();
    // Pristine create → Save disabled until label is non-empty.
    expect(screen.getByTestId('bank-account-save')).toBeDisabled();
  });

  test('?register=<identifier> deep-link opens the modal with a pending UPI', async () => {
    withAccounts([]);
    renderWithProviders(<BankAccountsPage />, {
      initialEntries: [{ pathname: '/', search: '?register=user%40upi' }],
    });
    await waitFor(() =>
      expect(screen.getByTestId('bank-account-label')).toBeInTheDocument()
    );
    // The pending identifier chip is seeded from the deep-link.
    expect(screen.getByText('user@upi')).toBeInTheDocument();
  });

  test('row ⋯ opens the edit modal pre-filled with the row label', async () => {
    withAccounts([fixture({ uid: 7, label: 'Axis Bank' })]);
    renderWithProviders(<BankAccountsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bank-account-open-7')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('bank-account-open-7'));
    expect(screen.getByTestId('bank-account-label')).toHaveValue('Axis Bank');
  });
});
