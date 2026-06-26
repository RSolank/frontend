import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { HIGHLIGHT_PULSE } from '../../../shared/utils/highlight';
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
    http.get(`${API_BASE}/recurring/templates`, () => HttpResponse.json(rows)),
    http.get(`${API_BASE}/beneficiaries`, () => HttpResponse.json(BEN_FIXTURE))
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

  test('defaults to Detected and routes statuses to the right tab', async () => {
    withTemplates([
      templateFixture({ uid: 1, status: 'candidate' }),
      templateFixture({ uid: 2, status: 'review' }),
      templateFixture({ uid: 3, status: 'locked' }),
      templateFixture({ uid: 4, status: 'locked', active: false }),
    ]);
    renderWithProviders(<RecurringPage />);

    // Candidates exist → Detected is the default landing tab, showing only the
    // candidate row.
    await waitFor(() =>
      expect(screen.getByTestId('recurring-row-1')).toBeInTheDocument()
    );
    expect(screen.getByTestId('recurring-tab-detected')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByTestId('recurring-row-3')).toBeNull();

    // Confirmed tab holds review + locked + paused, in that order.
    await userEvent.click(screen.getByTestId('recurring-tab-confirmed'));
    const titles = screen
      .getAllByRole('region')
      .map((s) => s.getAttribute('aria-label'));
    const idxReview = titles.indexOf('Needs attention');
    const idxConfirmed = titles.indexOf('Confirmed');
    const idxPaused = titles.indexOf('Paused');
    expect(idxReview).toBeGreaterThanOrEqual(0);
    expect(idxReview).toBeLessThan(idxConfirmed);
    expect(idxConfirmed).toBeLessThan(idxPaused);
    // The candidate is not on the Confirmed tab.
    expect(screen.queryByTestId('recurring-row-1')).toBeNull();
  });

  test('Confirm button shown on detected, hidden on confirmed locked rows', async () => {
    withTemplates([
      templateFixture({ uid: 1, status: 'candidate' }),
      templateFixture({ uid: 3, status: 'locked' }),
    ]);
    renderWithProviders(<RecurringPage />);

    // Detected tab (default): candidate offers Confirm.
    await waitFor(() =>
      expect(screen.getByTestId('recurring-confirm-1')).toBeInTheDocument()
    );

    // Confirmed tab: a locked row offers no Confirm.
    await userEvent.click(screen.getByTestId('recurring-tab-confirmed'));
    expect(screen.getByTestId('recurring-row-3')).toBeInTheDocument();
    expect(screen.queryByTestId('recurring-confirm-3')).toBeNull();
  });

  test('Detected "show more" reveals candidates beyond the preview', async () => {
    withTemplates(
      Array.from({ length: 7 }, (_, i) =>
        templateFixture({ uid: i + 1, status: 'candidate' })
      )
    );
    renderWithProviders(<RecurringPage />);

    // Only the first 5 candidates show; 6 and 7 are behind the reveal.
    await waitFor(() =>
      expect(screen.getByTestId('recurring-row-1')).toBeInTheDocument()
    );
    expect(screen.getByTestId('recurring-row-5')).toBeInTheDocument();
    expect(screen.queryByTestId('recurring-row-6')).toBeNull();

    await userEvent.click(screen.getByTestId('recurring-detected-show-more'));
    expect(screen.getByTestId('recurring-row-6')).toBeInTheDocument();
    expect(screen.getByTestId('recurring-row-7')).toBeInTheDocument();
    expect(screen.queryByTestId('recurring-detected-show-more')).toBeNull();
  });

  test('deep-link to a candidate lands on the Detected tab', async () => {
    withTemplates([
      templateFixture({ uid: 1, status: 'candidate' }),
      templateFixture({ uid: 3, status: 'locked' }),
    ]);
    renderWithProviders(<RecurringPage />, {
      initialEntries: ['/recurring?template=1'],
    });
    await waitFor(() =>
      expect(screen.getByTestId('recurring-row-1')).toBeInTheDocument()
    );
    expect(screen.getByTestId('recurring-tab-detected')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('deep-link to a confirmed template lands on the Confirmed tab', async () => {
    withTemplates([
      templateFixture({ uid: 1, status: 'candidate' }),
      templateFixture({ uid: 3, status: 'locked' }),
    ]);
    renderWithProviders(<RecurringPage />, {
      initialEntries: ['/recurring?template=3'],
    });
    await waitFor(() =>
      expect(screen.getByTestId('recurring-row-3')).toBeInTheDocument()
    );
    expect(screen.getByTestId('recurring-tab-confirmed')).toHaveAttribute(
      'aria-current',
      'page'
    );
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

  test('?tab=upcoming deep-link lands directly on the Upcoming tab', async () => {
    // A candidate exists — which would otherwise default to Detected — so this
    // also proves the tab deep-link wins over the detected-candidates default.
    withTemplates([templateFixture({ uid: 1, status: 'candidate' })]);
    renderWithProviders(<RecurringPage />, {
      initialEntries: ['/settings/recurring?tab=upcoming'],
    });
    await waitFor(() =>
      expect(screen.getByTestId('recurring-tab-upcoming')).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
    expect(screen.getByTestId('recurring-tab-detected')).not.toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('?bill deep-link lands on Upcoming and highlights the bill row', async () => {
    server.use(
      http.get(`${API_BASE}/recurring/templates`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/beneficiaries`, () =>
        HttpResponse.json(BEN_FIXTURE)
      ),
      http.get(`${API_BASE}/recurring/upcoming`, () =>
        HttpResponse.json([
          {
            uid: 42,
            template_id: 1,
            beneficiary_id: 7,
            expected_amount: 1200,
            debit_credit: 'debit',
            due_date: '2026-07-15',
            status: 'pending',
            matched_txn_id: null,
          },
        ])
      )
    );
    renderWithProviders(<RecurringPage />, {
      initialEntries: ['/settings/recurring?tab=upcoming&bill=42'],
    });
    const row = await screen.findByTestId('upcoming-row-42');
    expect(screen.getByTestId('recurring-tab-upcoming')).toHaveAttribute(
      'aria-current',
      'page'
    );
    await waitFor(() => expect(row.className).toContain(HIGHLIGHT_PULSE));
  });
});
