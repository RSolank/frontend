import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { ExpenseTrackerPage } from './ExpenseTrackerPage';

const statusResponse = {
  categories: [
    {
      tag_id: 11,
      tag_name: 'Groceries',
      tag_type: 'essential',
      current_expense: 300,
      avg_expense: 250,
      min_expense: 200,
      max_expense: 400,
      limit_amt: 350,
      penalty_rate: 0.05,
      default_penalty_rate: 0.05,
    },
    {
      tag_id: 12,
      tag_name: 'Dining',
      tag_type: 'discretionary',
      current_expense: 220,
      avg_expense: 150,
      min_expense: 100,
      max_expense: 220,
      // Over-budget case (220 > 200).
      limit_amt: 200,
      penalty_rate: 0.1,
      default_penalty_rate: 0.05,
    },
    {
      tag_id: 13,
      tag_name: 'Hobbies',
      tag_type: 'discretionary',
      current_expense: 50,
      avg_expense: 60,
      min_expense: 20,
      max_expense: 90,
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
      current_expense: 0,
      avg_expense: 0,
      min_expense: 0,
      max_expense: 0,
      limit_amt: null,
      penalty_rate: null,
      default_penalty_rate: 0.05,
    },
  ],
  total_budget: {
    tag_id: 1,
    tag_name: 'Total Budget',
    tag_type: 'total',
    current_expense: 570,
    avg_expense: 460,
    min_expense: 320,
    max_expense: 710,
    limit_amt: 1000,
    penalty_rate: 0.05,
    default_penalty_rate: 0.05,
  },
  currency: 'USD',
  month: '2026-02',
  available_months: ['2026-02', '2026-01', '2025-12'],
};

function installHandlers() {
  server.use(
    http.get('http://localhost:4000/api/budget-limits/status', () =>
      HttpResponse.json(statusResponse)
    ),
    http.get('http://localhost:4000/api/metadata/currencies', () =>
      HttpResponse.json({
        currencies: [{ code: 'USD', label: 'USD - US Dollar', symbol: '$' }],
      })
    )
  );
}

describe('ExpenseTrackerPage', () => {
  beforeEach(() => {
    usePreferencesStore.getState().setPreferences({
      currency: 'USD',
      country: 'US',
      timezone: 'UTC',
    });
    installHandlers();
  });

  it('renders the Total Budget overview + filtered category cards + page-scoped month picker', async () => {
    renderWithProviders(<ExpenseTrackerPage />);

    await waitFor(() =>
      expect(screen.getByTestId('budget-card-1')).toBeInTheDocument()
    );

    // Total budget (emphasis variant) — title + Spent / Limit values.
    const total = screen.getByTestId('budget-card-1');
    expect(total).toHaveTextContent('Total Budget');
    expect(total).toHaveTextContent('$570.00');
    expect(total).toHaveTextContent('$1,000.00');

    // Month picker lives in the PAGE header, not inside the Total
    // card — it scopes every card on the page.
    const monthSelect = screen.getByTestId('expense-tracker-month-select');
    expect(monthSelect).toBeInTheDocument();
    expect(within(total).queryByTestId('expense-tracker-month-select')).toBeNull();

    // Category cards render (idle filtered out, over-budget status on
    // Dining via the gradient progress bar, Set vs Edit affordance per
    // limit presence).
    expect(screen.getByTestId('budget-card-11')).toBeInTheDocument();
    expect(screen.getByTestId('budget-card-12')).toBeInTheDocument();
    expect(screen.getByTestId('budget-card-13')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-card-14')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('budget-card-12')).getByTestId(
        'budget-progress-over'
      )
    ).toBeInTheDocument();
  });

  it('progress bar uses gradient thresholds — safe / watch / near / over', async () => {
    server.use(
      http.get('http://localhost:4000/api/budget-limits/status', () =>
        HttpResponse.json({
          ...statusResponse,
          categories: [
            // safe — 50/200 = 25%
            { ...statusResponse.categories[0]!, tag_id: 101, tag_name: 'Safe Cat', current_expense: 50, limit_amt: 200 },
            // watch — 140/200 = 70%
            { ...statusResponse.categories[0]!, tag_id: 102, tag_name: 'Watch Cat', current_expense: 140, limit_amt: 200 },
            // near — 180/200 = 90%
            { ...statusResponse.categories[0]!, tag_id: 103, tag_name: 'Near Cat', current_expense: 180, limit_amt: 200 },
            // over — 250/200 = 125%
            { ...statusResponse.categories[0]!, tag_id: 104, tag_name: 'Over Cat', current_expense: 250, limit_amt: 200 },
          ],
        })
      )
    );

    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-101')).toBeInTheDocument()
    );

    expect(
      within(screen.getByTestId('budget-card-101')).getByTestId(
        'budget-progress-safe'
      )
    ).toHaveTextContent('On track');
    expect(
      within(screen.getByTestId('budget-card-102')).getByTestId(
        'budget-progress-watch'
      )
    ).toHaveTextContent('Watch');
    expect(
      within(screen.getByTestId('budget-card-103')).getByTestId(
        'budget-progress-near'
      )
    ).toHaveTextContent('Near limit');
    expect(
      within(screen.getByTestId('budget-card-104')).getByTestId(
        'budget-progress-over'
      )
    ).toHaveTextContent('Over budget');
  });

  it('Min / Max are dropped from category cards but kept on the rolling stats strip', async () => {
    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    // Category cards no longer surface Min / Max labels.
    const groceries = screen.getByTestId('budget-card-11');
    expect(groceries).not.toHaveTextContent(/Min \/ Max/i);
    expect(groceries).not.toHaveTextContent(/Lowest monthly/);
    expect(groceries).not.toHaveTextContent(/Highest monthly/);

    // Rolling stats strip lives below the Total card and surfaces all
    // three rollup stats with the locked labels.
    const stats = screen.getByTestId('rolling-stats');
    expect(stats).toHaveTextContent('Average monthly spend');
    expect(stats).toHaveTextContent('Lowest monthly spend');
    expect(stats).toHaveTextContent('Highest monthly spend');
    expect(stats).toHaveTextContent('$460.00');
    expect(stats).toHaveTextContent('$320.00');
    expect(stats).toHaveTextContent('$710.00');
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
    expect(within(dialog).getByTestId('budget-slider-bubble')).toHaveTextContent(
      '$350.00'
    );
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
      http.post(
        'http://localhost:4000/api/budget-limits/',
        async ({ request }) => {
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
        }
      ),
      http.get('http://localhost:4000/api/budget-limits/status', () => {
        getCount += 1;
        if (getCount === 1) return HttpResponse.json(statusResponse);
        return HttpResponse.json({
          ...statusResponse,
          categories: statusResponse.categories.map((c) =>
            c.tag_id === 11
              ? { ...c, limit_amt: 425, penalty_rate: 0.075 }
              : c
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

  it('Remove button surfaces a "backend pending" notice when DELETE 404s (scaffold path)', async () => {
    let deleteHit = false;
    server.use(
      http.delete(
        'http://localhost:4000/api/budget-limits/:tagId',
        () => {
          deleteHit = true;
          return new HttpResponse(null, { status: 404 });
        }
      )
    );

    renderWithProviders(<ExpenseTrackerPage />);
    await waitFor(() =>
      expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('budget-card-edit-11'));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByTestId('budget-form-remove'));

    // ConfirmDialog opens. Click Remove to fire the request.
    const confirm = await screen.findByRole('dialog', {
      name: /Remove this budget/,
    });
    fireEvent.click(within(confirm).getByRole('button', { name: /Remove/ }));

    await waitFor(() => expect(deleteHit).toBe(true));
    await waitFor(() => {
      expect(
        within(dialog).getByRole('alert')
      ).toHaveTextContent(/backend endpoint that hasn['’]t shipped yet/);
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
      http.delete(
        'http://localhost:4000/api/budget-limits/:tagId',
        ({ params }) => {
          deletedTagId = String(params.tagId);
          return new HttpResponse(null, { status: 204 });
        }
      ),
      http.get('http://localhost:4000/api/budget-limits/status', () => {
        getCount += 1;
        if (getCount === 1) return HttpResponse.json(statusResponse);
        return HttpResponse.json({
          ...statusResponse,
          categories: statusResponse.categories.map((c) =>
            c.tag_id === 11
              ? { ...c, limit_amt: null, penalty_rate: null }
              : c
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
      http.get(
        'http://localhost:4000/api/budget-limits/status',
        ({ request }) => {
          const url = new URL(request.url);
          const monthParam = url.searchParams.get('month');
          if (monthParam) secondGetMonth = monthParam;
          return HttpResponse.json({
            ...statusResponse,
            month: monthParam ?? '2026-02',
          });
        }
      )
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

  // Batch 9.5 — anomaly badges on category cards. Classification:
  //   below typical   : current ≤ avg * 0.75
  //   typical         : avg * 0.75 < current ≤ avg * 1.25
  //   near typical max: avg * 1.25 < current ≤ max
  //   above typical   : current > max
  // Hidden when avg ≤ 0 (fresh signup) or current ≤ 0.
  describe('anomaly badges', () => {
    it('renders the typical / near / above bands per the fixture data', async () => {
      renderWithProviders(<ExpenseTrackerPage />);
      await waitFor(() =>
        expect(screen.getByTestId('budget-card-11')).toBeInTheDocument()
      );

      // Groceries: current=300, avg=250 → 300 ≤ 312.5 → typical (slate).
      expect(
        within(screen.getByTestId('budget-card-11')).getByTestId(
          'budget-anomaly-typical'
        )
      ).toHaveTextContent('Typical');

      // Dining: current=220, avg=150 → 220 > 187.5 AND 220 ≤ max=220 → near.
      expect(
        within(screen.getByTestId('budget-card-12')).getByTestId(
          'budget-anomaly-near'
        )
      ).toHaveTextContent('Near typical max');

      // Hobbies: current=50, avg=60 → 50 ≥ 45 (0.75*60) → typical.
      expect(
        within(screen.getByTestId('budget-card-13')).getByTestId(
          'budget-anomaly-typical'
        )
      ).toBeInTheDocument();
    });

    it('renders "above" band when current > max and "below" when current ≤ 0.75 * avg', async () => {
      server.use(
        http.get('http://localhost:4000/api/budget-limits/status', () =>
          HttpResponse.json({
            ...statusResponse,
            categories: [
              {
                ...statusResponse.categories[0]!,
                tag_id: 201,
                tag_name: 'Above Max',
                current_expense: 500,
                avg_expense: 200,
                min_expense: 150,
                max_expense: 400,
                limit_amt: 1000,
              },
              {
                ...statusResponse.categories[0]!,
                tag_id: 202,
                tag_name: 'Quiet Month',
                current_expense: 60,
                avg_expense: 200,
                min_expense: 150,
                max_expense: 400,
                limit_amt: 1000,
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
        within(screen.getByTestId('budget-card-201')).getByTestId(
          'budget-anomaly-above'
        )
      ).toHaveTextContent('Above typical max');
      expect(
        within(screen.getByTestId('budget-card-202')).getByTestId(
          'budget-anomaly-below'
        )
      ).toHaveTextContent('Below typical');
    });

    it('hides the badge when there is no historical baseline yet (avg = 0)', async () => {
      server.use(
        http.get('http://localhost:4000/api/budget-limits/status', () =>
          HttpResponse.json({
            ...statusResponse,
            categories: [
              {
                ...statusResponse.categories[0]!,
                tag_id: 301,
                tag_name: 'Fresh',
                current_expense: 100,
                avg_expense: 0,
                min_expense: 0,
                max_expense: 0,
                limit_amt: 500,
              },
            ],
          })
        )
      );

      renderWithProviders(<ExpenseTrackerPage />);
      await waitFor(() =>
        expect(screen.getByTestId('budget-card-301')).toBeInTheDocument()
      );
      const card = screen.getByTestId('budget-card-301');
      expect(within(card).queryByTestId(/^budget-anomaly-/)).toBeNull();
    });
  });
});
