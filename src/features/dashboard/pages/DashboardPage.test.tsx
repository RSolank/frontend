import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import { weekRangeInTz } from '../../taxation/api/billPeriod';

import { DashboardPage } from './DashboardPage';

// Compute the active week relative to wall-clock time. The cards
// filter transactions to "this week" using the same helper, so the
// mock data uses the same computation — stays valid no matter when
// the suite runs.
const { period_start: WEEK_START, period_end: WEEK_END } = weekRangeInTz(
  new Date(),
  'UTC'
);

const populatedBudgetStatus = {
  categories: [
    {
      tag_id: 11,
      tag_name: 'Groceries',
      tag_type: 'essential',
      current_net_expense: 400,
      avg_net_expense: 380,
      min_net_expense: 200,
      max_net_expense: 500,
      limit_amt: 600,
      penalty_rate: 0.05,
      default_penalty_rate: 0.05,
    },
    {
      tag_id: 12,
      tag_name: 'Dining',
      tag_type: 'discretionary',
      current_net_expense: 250,
      avg_net_expense: 150,
      min_net_expense: 100,
      max_net_expense: 250,
      limit_amt: 200, // over-budget (250 > 200)
      penalty_rate: 0.1,
      default_penalty_rate: 0.05,
    },
    {
      tag_id: 13,
      tag_name: 'Hobbies',
      tag_type: 'discretionary',
      current_net_expense: 50,
      avg_net_expense: 60,
      min_net_expense: 20,
      max_net_expense: 90,
      limit_amt: null,
      penalty_rate: null,
      default_penalty_rate: 0.05,
    },
    {
      tag_id: 14,
      tag_name: 'Idle',
      tag_type: 'discretionary',
      current_net_expense: 0,
      avg_net_expense: 0,
      min_net_expense: 0,
      max_net_expense: 0,
      limit_amt: null,
      penalty_rate: null,
      default_penalty_rate: 0.05,
    },
  ],
  total_budget: {
    tag_id: 1,
    tag_name: 'Total Budget',
    tag_type: 'total',
    current_net_expense: 700,
    avg_net_expense: 600,
    min_net_expense: 400,
    max_net_expense: 800,
    limit_amt: 1500,
    penalty_rate: 0.05,
    default_penalty_rate: 0.05,
  },
  currency: 'USD',
  month: '2026-02',
  available_months: ['2026-02'],
};

// Helper — produce an ISO datetime exactly N days after WEEK_START at
// noon UTC. Used to anchor mock txns inside the active week without
// hand-typing dates that might fall outside the rolling boundary.
function dayInWeek(offset: number): string {
  const [y, m, d] = WEEK_START.split('-').map(Number);
  const noonUtc = Date.UTC(y as number, (m as number) - 1, d as number, 12) +
    offset * 86_400_000;
  return new Date(noonUtc).toISOString();
}

const populatedTransactions = {
  transactions: [
    {
      txn_id: 101,
      txn_date: dayInWeek(0), // Sun
      beneficiary_name: 'Coffee Shop',
      beneficiary: 'Coffee Shop',
      amount: 12,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [12],
    },
    {
      txn_id: 102,
      txn_date: dayInWeek(2), // Tue
      beneficiary_name: 'Supermarket',
      beneficiary: 'Supermarket',
      amount: 88,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [11],
    },
    {
      txn_id: 103,
      txn_date: dayInWeek(1), // Mon
      beneficiary_name: 'Bus Pass',
      beneficiary: 'Bus Pass',
      amount: 30,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [],
    },
    {
      txn_id: 104,
      txn_date: dayInWeek(6), // Sat
      beneficiary_name: 'Refund',
      beneficiary: 'Refund',
      amount: 25,
      debit_credit: 'credit',
      source: 'manual',
      tag_ids: [],
    },
    {
      txn_id: 105,
      txn_date: dayInWeek(4), // Thu
      beneficiary_name: 'Lunch',
      beneficiary: 'Lunch',
      amount: 18,
      debit_credit: 'debit',
      source: 'manual',
      tag_ids: [12],
    },
  ],
  returned_count: 5,
};

const populatedTracker = {
  period_start: WEEK_START,
  period_end: WEEK_END,
  running_tax: 12.5,
  running_penalty: 2.5,
  projected_tax: 30,
  projected_penalty: 6,
  per_tag: [
    { tag_id: 12, tag_name: 'Dining', txn_type: 'discretionary', tax_amount: 7, penalty: 2.5 },
    { tag_id: 11, tag_name: 'Groceries', txn_type: 'essential', tax_amount: 5.5, penalty: 0 },
  ],
};

function installPopulatedHandlers() {
  server.use(
    http.get(`${API_BASE}/budget-limits/status`, () =>
      HttpResponse.json(populatedBudgetStatus)
    ),
    http.get(`${API_BASE}/transactions`, ({ request }) => {
      const url = new URL(request.url);
      // Recent list (limit=5, no debit_credit filter) returns the full
      // populated list; week-aggregate query (debit_credit=debit) gets
      // the same list filtered to debits.
      if (url.searchParams.get('debit_credit') === 'debit') {
        return HttpResponse.json({
          transactions: populatedTransactions.transactions.filter(
            (t) => t.debit_credit === 'debit'
          ),
          returned_count: 4,
        });
      }
      return HttpResponse.json(populatedTransactions);
    }),
    // `useTrackerCurrentWeekQuery` now derives the running-tax view
    // from the ACCRUING bill (see `features/taxation/api/queries.ts`).
    // Seed one bill with totals + items matching `populatedTracker`.
    http.get(`${API_BASE}/consumption-tax/bills`, () =>
      HttpResponse.json({
        bills: [
          {
            bill_id: 7777,
            period_start: WEEK_START,
            period_end: WEEK_END,
            status: 'ACCRUING',
            amount: 15,
            amount_paid: 0,
          },
        ],
      })
    ),
    http.get(`${API_BASE}/consumption-tax/bills/7777`, () =>
      HttpResponse.json({
        bill_id: 7777,
        period_start: WEEK_START,
        period_end: WEEK_END,
        status: 'ACCRUING',
        amount: 15,
        amount_paid: 0,
        totals: {
          tax_total: populatedTracker.running_tax,
          penalty_total: populatedTracker.running_penalty,
        },
        items: populatedTracker.per_tag.map((p, idx) => ({
          txn_id: 9000 + idx,
          date: WEEK_START,
          beneficiary: p.tag_name,
          txn_type: p.txn_type,
          amount: p.tax_amount * 10,
          debit_credit: 'debit',
          tax_amount: p.tax_amount,
          penalty: p.penalty,
          tag_id: p.tag_id,
          tag_name: p.tag_name,
          penalty_tag_id: p.tag_id,
          penalty_tag_name: p.tag_name,
        })),
      })
    ),
    http.get(`${API_BASE}/metadata/currencies`, () =>
      HttpResponse.json({
        currencies: [{ code: 'USD', label: 'USD - US Dollar', symbol: '$' }],
      })
    )
  );
}

function installEmptyHandlers() {
  server.use(
    http.get(`${API_BASE}/budget-limits/status`, () =>
      HttpResponse.json({
        categories: [],
        total_budget: null,
        currency: 'USD',
        month: '2026-02',
        available_months: ['2026-02'],
      })
    ),
    http.get(`${API_BASE}/transactions`, () =>
      HttpResponse.json({ transactions: [], returned_count: 0 })
    ),
    // Empty-state shape: no ACCRUING bill → tracker renders the
    // "No tax accrued for this week yet." card.
    http.get(`${API_BASE}/consumption-tax/bills`, () =>
      HttpResponse.json({ bills: [] })
    ),
    http.get(`${API_BASE}/metadata/currencies`, () =>
      HttpResponse.json({
        currencies: [{ code: 'USD', label: 'USD - US Dollar', symbol: '$' }],
      })
    )
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
    useAuthStore.getState().setUser({
      user_id: 1,
      email_id: 'u@example.com',
      first_name: 'Sam',
    });
  });

  describe('populated state', () => {
    beforeEach(() => {
      installPopulatedHandlers();
    });

    it('renders the welcome heading with the user first name', async () => {
      renderWithProviders(<DashboardPage />);
      expect(
        await screen.findByRole('heading', { name: /Welcome back, Sam/ })
      ).toBeInTheDocument();
    });

    it('renders all three primary cards in a single grid', async () => {
      renderWithProviders(<DashboardPage />);
      // The primary grid contains all three cards.
      const grid = await screen.findByTestId('dashboard-primary-grid');
      expect(
        within(grid).getByTestId('dashboard-transactions-card')
      ).toBeInTheDocument();
      expect(
        within(grid).getByTestId('dashboard-expense-card')
      ).toBeInTheDocument();
      expect(
        within(grid).getByTestId('dashboard-tax-card')
      ).toBeInTheDocument();
    });

    it('Transactions card aggregates the active-week debits + lists the 5 recent rows', async () => {
      renderWithProviders(<DashboardPage />);
      const card = await screen.findByTestId('dashboard-transactions-card');
      // Three debits inside the week (12 + 88 + 30 + 18 — wait, all four
      // debits fall inside the week so total = 148, count = 4). The
      // credit refund (25) is excluded by the debit_credit filter.
      await waitFor(() =>
        expect(
          within(card).getByTestId('dashboard-transactions-week-total')
        ).toHaveTextContent('$148.00')
      );
      expect(
        within(card).getByTestId('dashboard-transactions-week-count')
      ).toHaveTextContent('4');
      // Recent list — all 5 rows render, debits in rose, credits in
      // emerald.
      const list = within(card).getByTestId('dashboard-transactions-list');
      expect(within(list).getByText('Coffee Shop')).toBeInTheDocument();
      expect(within(list).getByText('Refund')).toBeInTheDocument();
    });

    it('Expense Tracker card surfaces the rollup, top 3 categories, and a breach chip', async () => {
      renderWithProviders(<DashboardPage />);
      const card = await screen.findByTestId('dashboard-expense-card');
      await waitFor(() =>
        expect(
          within(card).getByTestId('dashboard-expense-rollup')
        ).toBeInTheDocument()
      );
      // Rollup shows total spend ($700) + limit ($1,500) — 46% → 'watch'? No, 46% → safe.
      expect(
        within(card).getByTestId('dashboard-expense-rollup')
      ).toHaveTextContent('$700.00');
      expect(
        within(card).getByTestId('dashboard-expense-rollup')
      ).toHaveTextContent('$1,500.00');
      // Breach chip (Dining is over budget).
      expect(
        within(card).getByTestId('dashboard-expense-breach-chip')
      ).toHaveTextContent('1 over budget');
      // Top 3 categories (Groceries / Dining / Hobbies — Idle is filtered).
      const list = within(card).getByTestId('dashboard-expense-category-list');
      expect(
        within(list).getByTestId('dashboard-expense-category-11')
      ).toBeInTheDocument();
      expect(
        within(list).getByTestId('dashboard-expense-category-12')
      ).toBeInTheDocument();
      expect(
        within(list).getByTestId('dashboard-expense-category-13')
      ).toBeInTheDocument();
      expect(
        within(list).queryByTestId('dashboard-expense-category-14')
      ).not.toBeInTheDocument();
    });

    it('Tax Tracker card shows accrued + projected totals and top contributors', async () => {
      renderWithProviders(<DashboardPage />);
      const card = await screen.findByTestId('dashboard-tax-card');
      // Accrued = running_tax + running_penalty = 12.5 + 2.5 = 15.
      await waitFor(() =>
        expect(
          within(card).getByTestId('dashboard-tax-accrued')
        ).toHaveTextContent('$15.00')
      );
      // Projected is now derived FE-side from `running_total /
      // fractionOfWeekElapsed` (the BE never shipped a `projected_*`
      // value; the `tracker/current-week` route never landed — see
      // `useTrackerCurrentWeekQuery` in
      // `features/taxation/api/queries.ts`). So the exact $-amount
      // floats with wall-clock day-of-week. Assert the slot rendered
      // with *some* dollar value rather than pinning a specific one.
      const projectedText = within(card)
        .getByTestId('dashboard-tax-projected')
        .textContent ?? '';
      expect(projectedText).toMatch(/\$\d+\.\d{2}/);
      // Top contributors list renders the two per_tag rows.
      const list = within(card).getByTestId('dashboard-tax-contributors');
      expect(within(list).getByText('Dining')).toBeInTheDocument();
      expect(within(list).getByText('Groceries')).toBeInTheDocument();
    });

    it('Secondary breach alerts widget renders only when there are breaches', async () => {
      renderWithProviders(<DashboardPage />);
      await waitFor(() =>
        expect(screen.getByTestId('dashboard-breach-alerts')).toBeInTheDocument()
      );
      const alerts = screen.getByTestId('dashboard-breach-alerts');
      // Dining is +$50 over its $200 limit.
      expect(
        within(alerts).getByTestId('dashboard-breach-12')
      ).toHaveTextContent('+$50.00 over');
    });

    it('Week summary widget surfaces the date range, spend, debit count, and tax accrual', async () => {
      renderWithProviders(<DashboardPage />);
      const widget = await screen.findByTestId('dashboard-week-summary');
      await waitFor(() => expect(widget).toHaveTextContent('$148.00'));
      expect(widget).toHaveTextContent('4'); // debit count
      // Tax accrued comes from the FE-derived tracker (bills →
      // bill detail), which resolves on a separate tick from the
      // txn-driven `$148.00` above. Wait for the second query
      // before asserting.
      await waitFor(() => expect(widget).toHaveTextContent('$15.00'));
    });

    it('Dashboard no longer renders an inline Activity widget — moved to TopNav bell in Batch 18', async () => {
      renderWithProviders(<DashboardPage />);
      // The widget previously rendered alongside BreachAlerts /
      // WeekSummary / UpcomingBills. Batch 18 relocated the feed to
      // the TopNav bell + lazy modal so it's visible app-wide, not
      // just on the dashboard. Pinning that the dashboard surface
      // does not bring the widget back.
      await waitFor(() =>
        expect(
          screen.queryByTestId('dashboard-activity')
        ).not.toBeInTheDocument()
      );
    });

    // Batch 9.5 — week-by-category strip aggregates the already-loaded
    // weekly debits by `tag_ids[0]` (the primary tag). Tag names come
    // from /api/tags. With the populated fixture (Coffee Shop=12+Lunch=18
    // → Dining=$30; Supermarket=88 → Groceries=$88; Bus Pass=30 →
    // Uncategorized) the top categories should be Groceries → Bus Pass
    // (Uncategorized) → Dining.
    it('Week-by-category strip aggregates weekly debits by primary tag', async () => {
      server.use(
        http.get(`${API_BASE}/tags`, () =>
          HttpResponse.json({
            tags: [
              {
                tag_id: 11,
                tag_name: 'Groceries',
                parent: null,
                tag_type: 'essential',
                aliases: [],
                created_by: 1,
              },
              {
                tag_id: 12,
                tag_name: 'Dining',
                parent: null,
                tag_type: 'discretionary',
                aliases: [],
                created_by: 1,
              },
            ],
          })
        )
      );

      renderWithProviders(<DashboardPage />);
      const card = await screen.findByTestId('dashboard-expense-card');
      const strip = await within(card).findByTestId(
        'dashboard-expense-week-list'
      );

      // Groceries: 88 (one txn) — top.
      const groceriesRow = within(strip).getByTestId(
        'dashboard-expense-week-row-11'
      );
      expect(groceriesRow).toHaveTextContent('Groceries');
      expect(groceriesRow).toHaveTextContent('$88.00');

      // Dining: 12 + 18 = 30 (two txns).
      const diningRow = within(strip).getByTestId(
        'dashboard-expense-week-row-12'
      );
      expect(diningRow).toHaveTextContent('Dining');
      expect(diningRow).toHaveTextContent('$30.00');
      expect(diningRow).toHaveTextContent('2 txns');
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      installEmptyHandlers();
    });

    it('Transactions card renders the friendly empty + Add CTA', async () => {
      renderWithProviders(<DashboardPage />);
      const card = await screen.findByTestId('dashboard-transactions-card');
      await waitFor(() =>
        expect(
          within(card).getByText(/No transactions yet/)
        ).toBeInTheDocument()
      );
      expect(
        within(card).getByRole('link', { name: /Add transaction/ })
      ).toHaveAttribute('href', '/transactions?add=true');
    });

    it('Expense Tracker card renders the friendly empty + Set CTA when no spend and no limits', async () => {
      renderWithProviders(<DashboardPage />);
      const card = await screen.findByTestId('dashboard-expense-card');
      await waitFor(() =>
        expect(
          within(card).getByText(/No budgets configured/)
        ).toBeInTheDocument()
      );
      expect(
        within(card).getByRole('link', { name: /Set your first budget/ })
      ).toHaveAttribute('href', '/budgets');
    });

    it('Tax Tracker card renders the friendly empty + Add CTA when the backend endpoint 404s', async () => {
      renderWithProviders(<DashboardPage />);
      const card = await screen.findByTestId('dashboard-tax-card');
      await waitFor(() =>
        expect(
          within(card).getByText(/No tax accrual yet this week/)
        ).toBeInTheDocument()
      );
      expect(
        within(card).getByRole('link', { name: /Add transaction/ })
      ).toBeInTheDocument();
    });

    it('Breach alerts widget is hidden when no breach exists', async () => {
      renderWithProviders(<DashboardPage />);
      // Other widgets render so we know the page mounted, then assert
      // the breach alerts are absent.
      await screen.findByTestId('dashboard-week-summary');
      expect(
        screen.queryByTestId('dashboard-breach-alerts')
      ).not.toBeInTheDocument();
    });
  });
});
