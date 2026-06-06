import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { TaxationRulesPage } from './TaxationRulesPage';

// Two customized rules + two "default" placeholders. Per the 2026-05-26
// design lock the page renders only is_default=false entries; the
// default placeholders surface as missing-and-Add-able slots.
const partiallyCustomized = {
  rules: [
    {
      txn_type: 'committed',
      tax_rate: 0.05,
      default_penalty_rate: 0.5,
      is_default: false,
    },
    {
      txn_type: 'essential',
      tax_rate: 0.1,
      default_penalty_rate: 0.5,
      is_default: false,
    },
    {
      txn_type: 'discretionary',
      tax_rate: 0,
      default_penalty_rate: 0.5,
      is_default: true,
    },
    {
      txn_type: 'uncategorized',
      tax_rate: 0,
      default_penalty_rate: 0.5,
      is_default: true,
    },
  ],
};

const fullyCustomized = {
  rules: partiallyCustomized.rules.map((r) => ({ ...r, is_default: false })),
};

function installListHandler(rules = partiallyCustomized) {
  server.use(
    http.get(`${API_BASE}/taxation-rules/`, () => HttpResponse.json(rules))
  );
}

function hydrateConstants() {
  useAuthStore.getState().setConstants({
    TOTAL_TAG_ID: 1,
    MISCELLANEOUS_TAG_ID: 2,
    CONSUMPTION_TAX_TAG_ID: 3,
    TAXABLE_TXN_TYPES: [
      'committed',
      'essential',
      'discretionary',
      'uncategorized',
    ],
    VALID_TAG_TYPES: [],
    VALID_TXN_TYPES: [],
    RELATIONSHIP_TYPES: [],
  });
}

describe('TaxationRulesPage', () => {
  beforeEach(() => {
    hydrateConstants();
    installListHandler();
  });

  it('renders one card per customized rule with rates as label/value pairs (no inline edit fields)', async () => {
    renderWithProviders(<TaxationRulesPage />);

    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toBeInTheDocument()
    );

    expect(screen.getByTestId('rule-card-committed')).toHaveTextContent('5%');
    expect(screen.getByTestId('rule-card-essential')).toHaveTextContent('10%');

    // Default placeholders are NOT rendered as cards.
    expect(
      screen.queryByTestId('rule-card-discretionary')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('rule-card-uncategorized')
    ).not.toBeInTheDocument();

    // Card body has no input fields — read-only.
    expect(
      within(screen.getByTestId('rule-card-committed')).queryByRole('textbox')
    ).not.toBeInTheDocument();
  });

  it('Add button is visible when at least one TAXABLE_TXN_TYPE is missing a rule', async () => {
    renderWithProviders(<TaxationRulesPage />);
    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toBeInTheDocument()
    );
    expect(screen.getByTestId('rule-add-button')).toBeInTheDocument();
  });

  it('Add button is hidden when every TAXABLE_TXN_TYPE has a customized rule', async () => {
    installListHandler(fullyCustomized);

    renderWithProviders(<TaxationRulesPage />);
    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('rule-add-button')).not.toBeInTheDocument();
  });

  it('Edit opens a modal pre-filled with the current rates and submits the update', async () => {
    let putBody: unknown = null;
    let getCount = 0;
    server.use(
      http.put(`${API_BASE}/taxation-rules/committed`, async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({
          rule: {
            txn_type: 'committed',
            tax_rate: 0.075,
            default_penalty_rate: 0.5,
            is_default: false,
          },
        });
      }),
      // First GET (initial render) → original 5%. Subsequent GETs
      // (after invalidation) → 7.5%. Order matters for the prefill
      // assertion below.
      http.get(`${API_BASE}/taxation-rules/`, () => {
        getCount += 1;
        if (getCount === 1) return HttpResponse.json(partiallyCustomized);
        return HttpResponse.json({
          rules: [
            {
              txn_type: 'committed',
              tax_rate: 0.075,
              default_penalty_rate: 0.5,
              is_default: false,
            },
            ...partiallyCustomized.rules.filter(
              (r) => r.txn_type !== 'committed'
            ),
          ],
        });
      })
    );

    renderWithProviders(<TaxationRulesPage />);
    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toHaveTextContent('5%')
    );

    fireEvent.click(
      within(screen.getByTestId('rule-card-committed')).getByRole('button', {
        name: /View \/ edit committed rule/i,
      })
    );

    // Seamless-transition convention (Batch 9.8): the modal always
    // renders the form, with the txn_type as a locked readOnly input.
    // No view-mode toggle to flip through.
    await waitFor(() =>
      expect(screen.getByTestId('rule-form-fixed-type')).toBeInTheDocument()
    );

    const user = userEvent.setup();
    const taxInput = screen.getByLabelText(/Tax rate/i) as HTMLInputElement;
    expect(taxInput.value).toBe('5%');
    await user.clear(taxInput);
    await user.type(taxInput, '7.5%');

    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => {
      expect(putBody).toEqual({ tax_rate: 0.075, default_penalty_rate: 0.5 });
    });
    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toHaveTextContent(
        '7.5%'
      )
    );
  });

  it('Add modal pre-fills the single missing txn_type when exactly one slot remains', async () => {
    // 3 customized rules → exactly one missing (uncategorized).
    server.use(
      http.get(`${API_BASE}/taxation-rules/`, () =>
        HttpResponse.json({
          rules: [
            {
              txn_type: 'committed',
              tax_rate: 0.05,
              default_penalty_rate: 0.5,
              is_default: false,
            },
            {
              txn_type: 'essential',
              tax_rate: 0.1,
              default_penalty_rate: 0.5,
              is_default: false,
            },
            {
              txn_type: 'discretionary',
              tax_rate: 0.2,
              default_penalty_rate: 0.5,
              is_default: false,
            },
            {
              txn_type: 'uncategorized',
              tax_rate: 0,
              default_penalty_rate: 0.5,
              is_default: true,
            },
          ],
        })
      )
    );

    renderWithProviders(<TaxationRulesPage />);
    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('rule-add-button'));

    const fixedType = await screen.findByTestId('rule-form-fixed-type');
    expect(fixedType).toHaveValue('uncategorized');
    // No combobox shown when only one slot is open.
    expect(
      screen.queryByRole('combobox', { name: /Transaction type/i })
    ).not.toBeInTheDocument();
  });

  it('Add modal shows a picker when two or more txn_types are missing', async () => {
    renderWithProviders(<TaxationRulesPage />);
    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('rule-add-button'));

    const picker = await screen.findByRole('combobox', {
      name: /Transaction type/i,
    });
    const options = within(picker).getAllByRole('option');
    // "Select a type…" placeholder + 2 missing entries.
    expect(options.map((o) => o.textContent)).toEqual([
      'Select a type…',
      'discretionary',
      'uncategorized',
    ]);
  });
});
