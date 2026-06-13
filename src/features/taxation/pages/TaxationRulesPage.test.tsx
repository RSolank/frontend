import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { TaxationRulesPage } from './TaxationRulesPage';

// The backend returns one effective rule per taxable type. Every taxable type
// ships seeded and the upsert never transfers provenance, so in practice all
// rows are system-origin (is_system=true). One row is given is_system=false
// here purely to pin the chip's conditional rendering.
const allRules = {
  rules: [
    {
      txn_type: 'committed',
      tax_rate: 0.05,
      default_penalty_rate: 0.5,
      is_system: true,
    },
    {
      txn_type: 'essential',
      tax_rate: 0.1,
      default_penalty_rate: 0.5,
      is_system: true,
    },
    {
      txn_type: 'discretionary',
      tax_rate: 0.2,
      default_penalty_rate: 0.5,
      is_system: false,
    },
    {
      txn_type: 'uncategorized',
      tax_rate: 0,
      default_penalty_rate: 0.5,
      is_system: true,
    },
  ],
};

function installListHandler(rules = allRules) {
  server.use(
    http.get(`${API_BASE}/taxation-rules/`, () => HttpResponse.json(rules))
  );
}

describe('TaxationRulesPage', () => {
  beforeEach(() => {
    installListHandler();
  });

  it('renders one read-only card per returned rule (every taxable type)', async () => {
    renderWithProviders(<TaxationRulesPage />);

    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toBeInTheDocument()
    );

    expect(screen.getByTestId('rule-card-committed')).toHaveTextContent('5%');
    expect(screen.getByTestId('rule-card-essential')).toHaveTextContent('10%');
    // All taxable types render as cards now — no Add-able placeholders.
    expect(
      screen.getByTestId('rule-card-discretionary')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('rule-card-uncategorized')
    ).toBeInTheDocument();

    // Card body has no input fields — read-only.
    expect(
      within(screen.getByTestId('rule-card-committed')).queryByRole('textbox')
    ).not.toBeInTheDocument();
  });

  it('shows the "System" chip on system-origin rows only', async () => {
    renderWithProviders(<TaxationRulesPage />);
    await waitFor(() =>
      expect(screen.getByTestId('rule-card-committed')).toBeInTheDocument()
    );

    // is_system=true → chip present.
    expect(
      within(screen.getByTestId('rule-card-committed')).getByText('System')
    ).toBeInTheDocument();
    // is_system=false → no chip.
    expect(
      within(screen.getByTestId('rule-card-discretionary')).queryByText(
        'System'
      )
    ).not.toBeInTheDocument();
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
            is_system: true,
          },
        });
      }),
      // First GET (initial render) → original 5%. Subsequent GETs (after
      // invalidation) → 7.5%. Order matters for the prefill assertion below.
      http.get(`${API_BASE}/taxation-rules/`, () => {
        getCount += 1;
        if (getCount === 1) return HttpResponse.json(allRules);
        return HttpResponse.json({
          rules: [
            {
              txn_type: 'committed',
              tax_rate: 0.075,
              default_penalty_rate: 0.5,
              is_system: true,
            },
            ...allRules.rules.filter((r) => r.txn_type !== 'committed'),
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

    // Seamless-transition convention (Batch 9.8): the modal always renders the
    // form, with the txn_type as a locked readOnly input.
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
});
