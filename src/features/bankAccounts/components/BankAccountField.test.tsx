import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import type { BankAccount } from '../api/schemas';

import { BankAccountField } from './BankAccountField';

function fixture(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    uid: 1,
    label: 'HDFC',
    account_type: 'REGULAR',
    is_committee_account: false,
    archived_at: null,
    identifiers: [],
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function NoopHarness({
  initial,
}: {
  initial: number | null;
}) {
  return (
    <BankAccountField
      id="bank-account-picker-test"
      label="Bank account"
      value={initial}
      onChange={() => {}}
    />
  );
}

describe('BankAccountField', () => {
  test('renders nothing when the user has no accounts', async () => {
    server.use(
      http.get(`${API_BASE}/bank-accounts/`, () =>
        HttpResponse.json([])
      )
    );
    renderWithProviders(<NoopHarness initial={null} />);
    // Wait for the query to settle, then assert the field is absent.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('bank-account-picker')).toBeNull();
  });

  test('renders label + picker when accounts exist; tax-pot suffix on committee row', async () => {
    server.use(
      http.get(`${API_BASE}/bank-accounts/`, () =>
        HttpResponse.json([
          fixture({ uid: 1, label: 'HDFC' }),
          fixture({
            uid: 2,
            label: 'Tax-pot',
            is_committee_account: true,
          }),
        ])
      )
    );
    renderWithProviders(<NoopHarness initial={null} />);
    await waitFor(() =>
      expect(screen.getByTestId('bank-account-picker')).toBeInTheDocument()
    );
    // Tax-pot suffix renders on the committee row only.
    expect(screen.getByText(/Tax-pot · Tax-pot/)).toBeInTheDocument();
    expect(screen.getByText('HDFC')).toBeInTheDocument();
  });

  test('onChange fires with numeric uid (or null for "No account")', async () => {
    server.use(
      http.get(`${API_BASE}/bank-accounts/`, () =>
        HttpResponse.json([fixture({ uid: 7, label: 'Axis' })])
      )
    );
    let last: number | null | undefined = undefined;
    function Harness() {
      return (
        <BankAccountField
          id="bank-account-picker-test"
          label="Bank account"
          value={null}
          onChange={(v) => {
            last = v;
          }}
        />
      );
    }
    renderWithProviders(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId('bank-account-picker')).toBeInTheDocument()
    );
    await userEvent.selectOptions(screen.getByTestId('bank-account-picker'), '7');
    expect(last).toBe(7);
  });
});
