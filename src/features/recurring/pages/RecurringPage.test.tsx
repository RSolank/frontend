import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import type { RecurringTemplate } from '../api/schemas';

import { RecurringPage } from './RecurringPage';

function templateFixture(
  overrides: Partial<RecurringTemplate>
): RecurringTemplate {
  return {
    uid: 1,
    beneficiary_id: 7,
    debit_credit: 'debit',
    pattern_type: 'FIXED_AMOUNT',
    expected_amount: 1200,
    amount_tolerance: 0.1,
    cadence: 'MONTHLY',
    cadence_interval: 1,
    day_of_month: 15,
    day_of_week: null,
    week_of_month: null,
    anchor_date: '2026-06-15',
    next_due_date: '2026-07-15',
    status: 'candidate',
    active: true,
    occurrence_count: 3,
    last_seen_date: '2026-05-15',
    last_confirmed_date: null,
    created_at: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

const BEN_FIXTURE = [
  {
    uid: 7,
    name: 'Acme Utilities',
    aliases: [],
    beneficiary_type: 'merchant',
    merchant: null,
    person: null,
  },
];

function withTemplates(rows: RecurringTemplate[]) {
  server.use(
    http.get(`${API_BASE}/recurring/templates`, () =>
      HttpResponse.json(rows)
    ),
    http.get(`${API_BASE}/beneficiaries`, () =>
      HttpResponse.json(BEN_FIXTURE)
    )
  );
}

describe('RecurringPage', () => {
  test('renders empty state when no templates exist', async () => {
    withTemplates([]);
    renderWithProviders(<RecurringPage />);
    await waitFor(() =>
      expect(screen.getByTestId('recurring-empty')).toBeInTheDocument()
    );
  });

  test('buckets templates by status, surfaces review first', async () => {
    withTemplates([
      templateFixture({ uid: 1, status: 'candidate' }),
      templateFixture({ uid: 2, status: 'review' }),
      templateFixture({ uid: 3, status: 'locked' }),
    ]);
    renderWithProviders(<RecurringPage />);
    await waitFor(() =>
      expect(screen.getByTestId('recurring-row-1')).toBeInTheDocument()
    );

    const sections = screen.getAllByRole('region');
    const titles = sections.map((s) => s.getAttribute('aria-label'));
    // "Needs attention" (review) must precede "Detected" (candidate)
    // which must precede "Confirmed" (locked).
    const idxReview = titles.indexOf('Needs attention');
    const idxDetected = titles.indexOf('Detected');
    const idxConfirmed = titles.indexOf('Confirmed');
    expect(idxReview).toBeGreaterThanOrEqual(0);
    expect(idxReview).toBeLessThan(idxDetected);
    expect(idxDetected).toBeLessThan(idxConfirmed);
  });

  test('Confirm button hidden on locked rows, shown on detected', async () => {
    withTemplates([
      templateFixture({ uid: 1, status: 'candidate' }),
      templateFixture({ uid: 3, status: 'locked' }),
    ]);
    renderWithProviders(<RecurringPage />);
    await waitFor(() =>
      expect(screen.getByTestId('recurring-row-1')).toBeInTheDocument()
    );
    expect(screen.getByTestId('recurring-confirm-1')).toBeInTheDocument();
    expect(screen.queryByTestId('recurring-confirm-3')).toBeNull();
  });

  test('Upcoming tab swaps to upcoming-bills list', async () => {
    withTemplates([]);
    renderWithProviders(<RecurringPage />);
    await waitFor(() =>
      expect(screen.getByTestId('recurring-tab-upcoming')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('recurring-tab-upcoming'));
    expect(screen.getByTestId('upcoming-empty')).toBeInTheDocument();
  });
});
