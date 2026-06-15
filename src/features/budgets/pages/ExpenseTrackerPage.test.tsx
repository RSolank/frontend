import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { ExpenseTrackerPage } from './ExpenseTrackerPage';

const statusResponse = {
  categories: [
    {
      tag_id: 11,
      tag_name: 'Groceries',
      tag_type: 'essential',
      current_net_expense: 300,
      avg_net_expense: 250,
      min_net_expense: 200,
      max_net_expense: 400,
      limit_amt: 350,
      penalty_rate: 0.05,
      default_penalty_rate: 0.05,
    },
    {
      tag_id: 12,
      tag_name: 'Dining',
      tag_type: 'discretionary',
      current_net_expense: 220,
      avg_net_expense: 150,
      min_net_expense: 100,
      max_net_expense: 220,
      // Over-budget case (220 > 200).
      limit_amt: 200,
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
      // No limit configured yet — should still render and show "Set
      // budget" affordance.
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
    current_net_expense: 570,
    avg_net_expense: 460,
    min_net_expense: 320,
    max_net_expense: 710,
    limit_amt: 1000,
    penalty_rate: 0.05,
    default_penalty_rate: 0.05,
  },
  currency: 'USD',
  month: '2026-02',
  available_months: ['2026-02', '2026-01', '2025-12'],
};

// Minimal expense-trend rows so Zone 2 (SpendTrendCard) + the Zone 1 MoM delta
// resolve. The FE filters by tag_id client-side, so one set covers both the
// total series and the category breakdown.
function trendRow(
  tag_id: number,
  tag_name: string,
  period_start: string,
  net: number
) {
  return {
    tag_id,
    tag_name,
    period_type: 'monthly',
    period_start,
    period_end: period_start,
    total_count: 1,
    total_debit: net,
    total_credit: 0,
    net_expense: net,
    avg_net_expense: null,
    min_net_expense: null,
    max_net_expense: null,
  };
}

function installHandlers() {
  server.use(
    http.get(`${API_BASE}/budget-limits/status`, () =>
      HttpResponse.json(statusResponse)
    ),
    http.get(`${API_BASE}/metadata/currencies`, () =>
      HttpResponse.json({
        currencies: [{ code: 'USD', label: 'USD - US Dollar', symbol: '$' }],
      })
    ),
    http.get(`${API_BASE}/expense-tracker/`, ({ request }) => {
      const tagId = new URL(request.url).searchParams.get('tag_id');
      let rows = [
        trendRow(1, 'Total Budget', '2026-01-01', 500),
        trendRow(1, 'Total Budget', '2026-02-01', 570),
        trendRow(11, 'Groceries', '2026-02-01', 300),
        trendRow(12, 'Dining', '2026-02-01', 220),
        trendRow(13, 'Hobbies', '2026-02-01', 50),
      ];
      if (tagId) rows = rows.filter((r) => String(r.tag_id) === tagId);
      return HttpResponse.json({
        period_type: 'monthly',
        returned_count: rows.length,
        rows,
      });
    })
  );
}

describe('ExpenseTrackerPage', () => {
  beforeEach(() => {
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
    // The page reads TOTAL / MISCELLANEOUS tag ids off the auth store to
    // anchor the trend + exclude Misc from the Zone 1 top-3.
    useAuthStore.getState().setConstants({
      TOTAL_TAG_ID: 1,
      MISCELLANEOUS_TAG_ID: 2,
      CONSUMPTION_TAX_TAG_ID: 3,
      TAXABLE_TXN_TYPES: [],
      VALID_TAG_TYPES: [],
      VALID_TXN_TYPES: [],
      RELATIONSHIP_TYPES: [],
    });
    installHandlers();
  });

  it('renders the Zone 1 overview + filtered category cards + page-scoped month picker', async () => {
    renderWithProviders(<ExpenseTrackerPage />);

    // Zone 1 — the overview card carries the total (no longer a category card).
    const overview = await screen.findByTestId('expense-overview');
    expect(overview).toHaveTextContent('Total spent');
    await waitFor(() => expect(overview).toHaveTextContent('$570.00'));
    // Total 570 / 1000 = 57% → "On track" signal.
    expect(within(overview).getByText('On track')).toBeInTheDocument();
    // "Where it went" surfaces the top categories.
    expect(overview).toHaveTextContent('Groceries');

    // Month picker lives in the PAGE header, not inside the overview.
    expect(screen.getByTestId('expense-tracker-month-select')).toBeInTheDocument();
    expect(
      within(overview).queryByTestId('expense-tracker-month-select')
    ).toBeNull();

    // Zone 3 — category cards render (idle filtered out); Dining is over budget.
    expect(screen.getByTestId('budget-card-11')).toBeInTheDocument();
    expect(screen.getByTestId('budget-card-12')).toBeInTheDocument();
    expect(screen.getByTestId('budget-card-13')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-card-14')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('budget-card-12')).getByText('Over budget')
    ).toBeInTheDocument();
  });

  it('BudgetSignal pills classify the four budget bands — safe / watch / near / over', async () => {
    server.use(
      http.get(`${API_BASE}/budget-limits/status`, () =>
        HttpResponse.json({
          ...statusResponse,
          categories: [
            // safe — 50/200 = 25%
            {
              ...statusResponse.categories[0]!,
              tag_id: 101,
              tag_name: 'Safe Cat',
              current_net_expense: 50,
              limit_amt: 200,
            },
            // watch — 140/200 = 70%
            {
              ...statusResponse.categories[0]!,
              tag_id: 102,
              tag_name: 'Watch Cat',
              current_net_expense: 140,
              limit_amt: 200,
            },
            // near — 180/200 = 90%
            {
              ...statusResponse.categories[0]!,
              tag_id: 103,
              tag_name: 'Near Cat',
              current_net_expense: 180,
              limit_amt: 200,
            },
            // over — 250/200 = 125%
            {
              ...statusResponse.categories[0]!,
              tag_id: 104,
              tag_name: 'Over Cat',
              current_net_expense: 250,
              limit_amt: 200,
            },
          ],
        })
      )
    );

    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-101')).toBeInTheDocument()
    );

    expect(
      within(screen.getByTestId('budget-card-101')).getByText('On track')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('budget-card-102')).getByText('Watch')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('budget-card-103')).getByText('Near limit')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('budget-card-104')).getByText('Over budget')
    ).toBeInTheDocument();
  });

  it('Min / Max are off category cards; rolling 12-month stats live in the trend footer', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    // Category cards no longer surface Min / Max labels.
    const groceries = screen.getByTestId('budget-card-11');
    expect(groceries).not.toHaveTextContent(/Lowest monthly/);
    expect(groceries).not.toHaveTextContent(/Highest monthly/);

    // The rolling 12-month rollup stats moved into the trend card footer.
    const trend = screen.getByTestId('spend-trend');
    expect(trend).toHaveTextContent('Last 12 months');
    await waitFor(() => expect(trend).toHaveTextContent('$460.00'));
    expect(trend).toHaveTextContent('$320.00');
    expect(trend).toHaveTextContent('$710.00');
  });

  it('view cards render label/value pairs only (no inline edit fields)', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );
    const card = screen.getByTestId('budget-card-11');
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(card).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(within(card).queryByRole('slider')).not.toBeInTheDocument();
  });

  it('Edit opens the modal with the slider + always-visible amount field pre-set to the existing limit', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));

    const dialog = await screen.findByRole('dialog', {
      name: /Edit budget — Groceries/,
    });

    // Both surfaces prefill to the existing limit (350) — they stay
    // synced for the lifetime of the modal.
    const slider = within(dialog).getByTestId(
      'budget-slider'
    ) as HTMLInputElement;
    expect(slider.value).toBe('350');

    const amountInput = within(dialog).getByTestId(
      'budget-amount-input'
    ) as HTMLInputElement;
    expect(amountInput.value).toBe('350');

    // Freeze checkbox is gone; the amount field replaces it.
    expect(
      within(dialog).queryByTestId('budget-freeze-range')
    ).not.toBeInTheDocument();

    // Bubble surfaces the formatted money value.
    expect(
      within(dialog).getByTestId('budget-slider-bubble')
    ).toHaveTextContent('$350.00');
  });

  it('Set-budget for a category with no existing limit defaults the slider to the rolling average', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-13')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-13'));

    const dialog = await screen.findByRole('dialog', {
      name: /Set budget — Hobbies/,
    });
    // Hobbies avg=60 → slider initial value = 60 (round of avg).
    const slider = within(dialog).getByTestId(
      'budget-slider'
    ) as HTMLInputElement;
    expect(slider.value).toBe('60');
  });

  it('Amount field INSIDE observed range live-updates the slider as the user types', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));
    const dialog = await screen.findByRole('dialog');

    const user = userEvent.setup();
    const amountInput = within(dialog).getByTestId(
      'budget-amount-input'
    ) as HTMLInputElement;
    // Groceries observed range: 200..400. 300 is inside → live update.
    await user.clear(amountInput);
    await user.type(amountInput, '300');

    const slider = within(dialog).getByTestId(
      'budget-slider'
    ) as HTMLInputElement;
    expect(slider.value).toBe('300');
  });

  it('Amount field OUTSIDE observed range commits on blur and expands slider range', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));
    const dialog = await screen.findByRole('dialog');

    const user = userEvent.setup();
    const amountInput = within(dialog).getByTestId(
      'budget-amount-input'
    ) as HTMLInputElement;
    // 900 is OUTSIDE the observed 200..400 range. Out-of-range typing
    // defers — fire blur to commit immediately.
    await user.clear(amountInput);
    await user.type(amountInput, '900');
    fireEvent.blur(amountInput);

    const slider = within(dialog).getByTestId(
      'budget-slider'
    ) as HTMLInputElement;
    await waitFor(() => expect(slider.value).toBe('900'));
    expect(Number(slider.max)).toBeGreaterThanOrEqual(900);
  });

  it('Slider drag updates the amount field (slider ↔ field stay in sync)', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));
    const dialog = await screen.findByRole('dialog');

    const slider = within(dialog).getByTestId(
      'budget-slider'
    ) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '275' } });

    const amountInput = within(dialog).getByTestId(
      'budget-amount-input'
    ) as HTMLInputElement;
    expect(amountInput.value).toBe('275');
  });

  it('Slider +/- step buttons nudge the value by one step', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));
    const dialog = await screen.findByRole('dialog');

    const slider = within(dialog).getByTestId(
      'budget-slider'
    ) as HTMLInputElement;
    const startValue = Number(slider.value);
    const step = Number(slider.step);

    fireEvent.click(within(dialog).getByTestId('budget-slider-step-plus'));
    expect(Number(slider.value)).toBe(startValue + step);

    fireEvent.click(within(dialog).getByTestId('budget-slider-step-minus'));
    expect(Number(slider.value)).toBe(startValue);
  });

  it('saves the slider value + penalty, invalidates, and re-renders', async () => {
    let postBody: unknown = null;
    let getCount = 0;
    server.use(
      http.post(`${API_BASE}/budget-limits/`, async ({ request }) => {
        postBody = await request.json();
        return HttpResponse.json({
          budget: {
            uid: 99,
            tag_id: 11,
            tag_name: 'Groceries',
            budget_period: 'monthly',
            limit_amt: 425,
            penalty_rate: 0.075,
            created_by: 1,
            created_at: '2026-02-15T12:00:00Z',
          },
        });
      }),
      http.get(`${API_BASE}/budget-limits/status`, () => {
        getCount += 1;
        if (getCount === 1) return HttpResponse.json(statusResponse);
        return HttpResponse.json({
          ...statusResponse,
          categories: statusResponse.categories.map((c) =>
            c.tag_id === 11 ? { ...c, limit_amt: 425, penalty_rate: 0.075 } : c
          ),
        });
      })
    );

    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));
    const dialog = await screen.findByRole('dialog');

    const user = userEvent.setup();
    // Type a precise value in the amount field — out-of-range, blur to
    // commit immediately.
    const amountInput = within(dialog).getByTestId(
      'budget-amount-input'
    ) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '425');
    fireEvent.blur(amountInput);

    const penaltyInput = within(dialog).getByLabelText(
      /Penalty rate/
    ) as HTMLInputElement;
    await user.clear(penaltyInput);
    await user.type(penaltyInput, '7.5%');

    fireEvent.click(screen.getByTestId('budget-form-save'));

    await waitFor(() => {
      expect(postBody).toEqual({
        tag_id: 11,
        budget_period: 'monthly',
        limit_amt: 425,
        penalty_rate: 0.075,
      });
    });

    await waitFor(() => {
      const card = screen.getByTestId('budget-card-11');
      expect(card).toHaveTextContent('$425.00');
    });
  });

  it('Remove button on a budget without an existing limit is hidden (no Remove for fresh budgets)', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-13')).toBeInTheDocument()
    );

    // Hobbies has no limit yet — modal opens in "Set" mode; no Remove.
    fireEvent.click(screen.getByTestId('budget-card-edit-13'));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).queryByTestId('budget-form-remove')
    ).not.toBeInTheDocument();
  });

  it('Remove button completes successfully when the backend honours DELETE (happy path)', async () => {
    let deletedTagId: string | null = null;
    let getCount = 0;
    server.use(
      http.delete(`${API_BASE}/budget-limits/:tagId`, ({ params }) => {
        deletedTagId = String(params.tagId);
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${API_BASE}/budget-limits/status`, () => {
        getCount += 1;
        if (getCount === 1) return HttpResponse.json(statusResponse);
        return HttpResponse.json({
          ...statusResponse,
          categories: statusResponse.categories.map((c) =>
            c.tag_id === 11 ? { ...c, limit_amt: null, penalty_rate: null } : c
          ),
        });
      })
    );

    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByTestId('budget-form-remove'));
    const confirm = await screen.findByRole('dialog', {
      name: /Remove this budget/,
    });
    fireEvent.click(within(confirm).getByRole('button', { name: /Remove/ }));

    await waitFor(() => expect(deletedTagId).toBe('11'));
    // Modal closes on success.
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Edit budget — Groceries/ })
      ).not.toBeInTheDocument()
    );
    // Card re-renders with "Set budget" affordance (limit cleared).
    await waitFor(() =>
      expect(
        within(screen.getByTestId('budget-card-11')).getByRole('button', {
          name: /Set budget for Groceries/,
        })
      ).toBeInTheDocument()
    );
  });

  it('Month picker switches the active month query', async () => {
    let secondGetMonth: string | null = null;
    server.use(
      http.get(`${API_BASE}/budget-limits/status`, ({ request }) => {
        const url = new URL(request.url);
        const monthParam = url.searchParams.get('month');
        if (monthParam) secondGetMonth = monthParam;
        return HttpResponse.json({
          ...statusResponse,
          month: monthParam ?? '2026-02',
        });
      })
    );

    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    const select = screen.getByTestId(
      'expense-tracker-month-select'
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2026-01' } });

    await waitFor(() => {
      expect(secondGetMonth).toBe('2026-01');
    });
  });

  // The unified BudgetSignal falls back to the rolling "typical" baseline when
  // no budget limit is set: below / typical / above / most-expensive-yet.
  describe('BudgetSignal — no-limit categories use the rolling baseline', () => {
    it('classifies below / typical / above / most-expensive bands', async () => {
      server.use(
        http.get(`${API_BASE}/budget-limits/status`, () =>
          HttpResponse.json({
            ...statusResponse,
            categories: [
              {
                ...statusResponse.categories[0]!,
                tag_id: 201,
                tag_name: 'Below Cat',
                current_net_expense: 60, // < 0.75 * 200
                avg_net_expense: 200,
                max_net_expense: 400,
                limit_amt: null,
              },
              {
                ...statusResponse.categories[0]!,
                tag_id: 202,
                tag_name: 'Typical Cat',
                current_net_expense: 200, // within ±25%
                avg_net_expense: 200,
                max_net_expense: 400,
                limit_amt: null,
              },
              {
                ...statusResponse.categories[0]!,
                tag_id: 203,
                tag_name: 'Above Cat',
                current_net_expense: 300, // > 1.25 * 200, ≤ max
                avg_net_expense: 200,
                max_net_expense: 400,
                limit_amt: null,
              },
              {
                ...statusResponse.categories[0]!,
                tag_id: 204,
                tag_name: 'Peak Cat',
                current_net_expense: 500, // > max
                avg_net_expense: 200,
                max_net_expense: 400,
                limit_amt: null,
              },
            ],
          })
        )
      );

      renderWithProviders(<ExpenseTrackerPage />);
      await waitFor(() =>
        expect(screen.getByTestId('budget-card-201')).toBeInTheDocument()
      );

      expect(
        within(screen.getByTestId('budget-card-201')).getByText('Below typical')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('budget-card-202')).getByText('Typical')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('budget-card-203')).getByText('Above typical')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('budget-card-204')).getByText(
          'Most expensive yet'
        )
      ).toBeInTheDocument();
    });

    it('shows "No budget set" with no history yet', async () => {
      server.use(
        http.get(`${API_BASE}/budget-limits/status`, () =>
          HttpResponse.json({
            ...statusResponse,
            categories: [
              {
                ...statusResponse.categories[0]!,
                tag_id: 301,
                tag_name: 'Fresh',
                current_net_expense: 100,
                avg_net_expense: 0,
                min_net_expense: 0,
                max_net_expense: 0,
                limit_amt: null,
              },
            ],
          })
        )
      );

      renderWithProviders(<ExpenseTrackerPage />);
      await waitFor(() =>
        expect(screen.getByTestId('budget-card-301')).toBeInTheDocument()
      );
      expect(
        within(screen.getByTestId('budget-card-301')).getByText('No budget set')
      ).toBeInTheDocument();
    });
  });
});
