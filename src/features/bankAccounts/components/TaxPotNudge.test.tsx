import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import { useTaxPotNudgeStore } from '../state/taxPotNudge.store';

import { TaxPotNudge } from './TaxPotNudge';

beforeEach(() => {
  useTaxPotNudgeStore.getState().reset();
});

afterEach(() => {
  useTaxPotNudgeStore.getState().reset();
});

describe('TaxPotNudge', () => {
  test('renders banner when no accounts have is_committee_account', async () => {
    server.use(
      http.get('http://localhost:4000/api/bank-accounts/', () =>
        HttpResponse.json([
          {
            uid: 1,
            label: 'HDFC',
            account_type: 'REGULAR',
            is_committee_account: false,
            archived_at: null,
            identifiers: [],
            created_at: '2026-06-01T00:00:00Z',
          },
        ])
      )
    );
    renderWithProviders(<TaxPotNudge />);
    await waitFor(() =>
      expect(screen.getByTestId('tax-pot-nudge-banner')).toBeInTheDocument()
    );
  });

  test('hides when at least one account is the committee account', async () => {
    server.use(
      http.get('http://localhost:4000/api/bank-accounts/', () =>
        HttpResponse.json([
          {
            uid: 1,
            label: 'Tax-pot',
            account_type: 'SAVINGS',
            is_committee_account: true,
            archived_at: null,
            identifiers: [],
            created_at: '2026-06-01T00:00:00Z',
          },
        ])
      )
    );
    renderWithProviders(<TaxPotNudge />);
    // Wait for the query to settle (otherwise we're just asserting on
    // the loading-state false-negative).
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('tax-pot-nudge-banner')).toBeNull();
  });

  test('dismiss button persists the dismissed flag', async () => {
    server.use(
      http.get('http://localhost:4000/api/bank-accounts/', () =>
        HttpResponse.json([])
      )
    );
    renderWithProviders(<TaxPotNudge />);
    await waitFor(() =>
      expect(screen.getByTestId('tax-pot-nudge-banner')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('tax-pot-nudge-dismiss'));
    expect(useTaxPotNudgeStore.getState().dismissed).toBe(true);
    expect(screen.queryByTestId('tax-pot-nudge-banner')).toBeNull();
  });
});
