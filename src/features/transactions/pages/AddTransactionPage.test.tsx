import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AddTransactionPage } from './AddTransactionPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom'
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTags = {
  tags: [
    {
      tag_id: 2,
      tag_name: 'Miscellaneous',
      parent: null,
      tag_type: 'discretionary',
      aliases: [],
      created_by: null,
      children: [],
    },
    {
      tag_id: 3,
      tag_name: 'Groceries',
      parent: null,
      tag_type: 'essential',
      aliases: [],
      created_by: null,
      children: [],
    },
    {
      tag_id: 4,
      tag_name: 'Dining',
      parent: null,
      tag_type: 'discretionary',
      aliases: [],
      created_by: null,
      children: [],
    },
  ],
};

// A beneficiary that already owns a categorization rule mapping it to
// Groceries (tag 3) — used by the auto-populate / rule-flow tests.
const ruledBeneficiary = {
  uid: 5,
  name: 'Coffee Shop',
  aliases: [],
  beneficiary_type: 'merchant',
  is_system: false,
};

const existingRule = {
  uid: 9,
  rule_name: 'Rule for Coffee Shop',
  beneficiary_id: 5,
  beneficiary_name: 'Coffee Shop',
  beneficiary_aliases: [],
  tag_ids: [3],
  notes: null,
  created_by: 42,
  is_system: false,
};

// Install a beneficiary + its rule so selecting it auto-populates tags.
function installRuledBeneficiary() {
  server.use(
    http.get(`${API_BASE}/beneficiaries`, () =>
      HttpResponse.json([ruledBeneficiary])
    ),
    http.get(`${API_BASE}/categorization-rules`, () =>
      HttpResponse.json({ rules: [existingRule] })
    )
  );
}

const mockConstants = {
  TOTAL_TAG_ID: 1,
  MISCELLANEOUS_TAG_ID: 2,
  CONSUMPTION_TAX_TAG_ID: 3,
};

beforeEach(() => {
  mockNavigate.mockReset();
  server.use(
    http.get(`${API_BASE}/tags`, () => HttpResponse.json(mockTags)),
    http.get(`${API_BASE}/beneficiaries`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/metadata/constants`, () =>
      HttpResponse.json(mockConstants)
    )
  );
});

describe('AddTransactionPage', () => {
  it('renders form fields', async () => {
    renderWithProviders(<AddTransactionPage />);
    expect(screen.getByText(/Add Transaction/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('submits the form successfully and navigates', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${API_BASE}/transactions`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ transaction: { txn_id: 1, amount: 50.5 } });
      })
    );

    renderWithProviders(<AddTransactionPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '50.50' },
    });
    fireEvent.change(screen.getByLabelText('Beneficiary'), {
      target: { value: 'Store' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Test note' },
    });

    const form = screen.getByText('Create Transaction').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(body).toMatchObject({
        amount: 50.5,
        beneficiary_name: 'Store',
        notes: 'Test note',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/transactions');
    });
  });

  it('auto-populates tags from the beneficiary rule and links it on submit (no rule-create, no 409)', async () => {
    installRuledBeneficiary();
    let body: { tag_ids?: number[] } | null = null;
    let url = '';
    let ruleCreateCalled = false;
    server.use(
      http.post(`${API_BASE}/categorization-rules`, () => {
        ruleCreateCalled = true;
        return HttpResponse.json({ rule: { uid: 99 } }, { status: 201 });
      }),
      http.post(`${API_BASE}/transactions`, async ({ request }) => {
        url = request.url;
        body = (await request.json()) as { tag_ids?: number[] };
        return HttpResponse.json({ transaction: { txn_id: 1 } });
      })
    );

    renderWithProviders(<AddTransactionPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );

    // Select the beneficiary that has a rule → tags auto-populate (Groceries).
    fireEvent.focus(screen.getByLabelText('Beneficiary'));
    fireEvent.mouseDown(await screen.findByText('Coffee Shop'));
    await waitFor(() =>
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '12' },
    });
    const form = screen.getByText('Create Transaction').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    // Tags unchanged from the rule → no prompt, linked to the existing rule,
    // and the rule-create endpoint is never hit (the old 409 path is gone).
    expect(body).toMatchObject({ tag_ids: [3] });
    expect(url).toContain('rule_id=9');
    expect(ruleCreateCalled).toBe(false);
    expect(screen.queryByText(/Create categorization rule/i)).toBeNull();
  });

  async function divergeThenSubmit() {
    installRuledBeneficiary();
    renderWithProviders(<AddTransactionPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );
    fireEvent.focus(screen.getByLabelText('Beneficiary'));
    fireEvent.mouseDown(await screen.findByText('Coffee Shop'));
    await waitFor(() =>
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    );
    // Add a second tag → tags now diverge from the rule ([3] → [3, 4]).
    fireEvent.focus(screen.getByLabelText('Tags'));
    fireEvent.mouseDown(await screen.findByText('Dining'));
    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '12' },
    });
    const form = screen.getByText('Create Transaction').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);
    // The read-only review modal opens (not the canonical editor — boundary).
    await waitFor(() =>
      expect(screen.getByText(/A rule already exists/i)).toBeInTheDocument()
    );
  }

  it('diverging tags → "Use for this transaction only" links no rule and stays', async () => {
    let body: { tag_ids?: number[] } | null = null;
    let url = '';
    server.use(
      http.post(`${API_BASE}/transactions`, async ({ request }) => {
        url = request.url;
        body = (await request.json()) as { tag_ids?: number[] };
        return HttpResponse.json({ transaction: { txn_id: 2 } });
      })
    );

    await divergeThenSubmit();
    fireEvent.click(screen.getByText('Use for this transaction only'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/transactions')
    );
    expect(body).toMatchObject({ tag_ids: [3, 4] });
    expect(url).not.toContain('rule_id='); // one-off, rule untouched
  });

  it('diverging tags → "Update rule…" saves linked + redirects to the rules page', async () => {
    let url = '';
    server.use(
      http.post(`${API_BASE}/transactions`, async ({ request }) => {
        url = request.url;
        await request.json();
        return HttpResponse.json({ transaction: { txn_id: 2 } });
      })
    );

    await divergeThenSubmit();
    fireEvent.click(screen.getByText('Update rule…'));

    // Txn saved linked to the existing rule, then navigated to the rules page
    // with the edit pre-fill (the rule edit happens there, not in a nested modal).
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/settings/categorization-rules',
        expect.objectContaining({
          state: expect.objectContaining({
            rulePrefill: expect.objectContaining({
              mode: 'edit',
              ruleId: 9,
              tagIds: [3, 4],
            }),
          }),
        })
      )
    );
    expect(url).toContain('rule_id=9');
  });

  it('shows an error when the create call fails', async () => {
    server.use(
      http.post(`${API_BASE}/transactions`, () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    );

    renderWithProviders(<AddTransactionPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('Beneficiary')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Beneficiary'), {
      target: { value: 'Store' },
    });

    const form = screen.getByText('Create Transaction').closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument();
    });
  });
});
