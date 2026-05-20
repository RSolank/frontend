import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CategorizationRulesTab } from './CategorizationRulesTab';
import { apiFetch } from '../../../utils/apiClient';

vi.mock('../../../utils/apiClient.js', () => ({
  apiFetch: vi.fn(),
}));

const mockRules = {
  rules: [
    {
      uid: 1,
      rule_name: 'TestShop -> Food (Groceries)',
      beneficiary_id: 10,
      beneficiary_name: 'TestShop',
      beneficiary_aliases: ['TS', 'Test Store'],
      tag_ids: [12],
      notes: 'A test rule',
      created_by: 1,
    },
    {
      uid: 2,
      rule_name: 'Reliance Fresh -> Food (Groceries)',
      beneficiary_id: 1,
      beneficiary_name: 'Reliance Fresh',
      beneficiary_aliases: [],
      tag_ids: [12],
      notes: null,
      created_by: 0,
    },
  ],
};

const mockTags = {
  tags: [
    {
      tag_id: 10,
      tag_name: 'Food',
      parent: null,
      children: [
        { tag_id: 12, tag_name: 'Groceries', parent: 10, children: [] },
      ],
    },
    { tag_id: 15, tag_name: 'Refunds', parent: null, children: [] },
  ],
};

const mockBeneficiaries = [
  { uid: 10, name: 'TestShop', aliases: ['TS', 'Test Store'], beneficiary_type: 'merchant' },
  { uid: 20, name: 'NewShop', aliases: [], beneficiary_type: 'merchant' },
];

const mockConstants = {
  SYSTEM_USER_ID: 0,
  TOTAL_TAG_ID: 1,
  MISCELLANEOUS_TAG_ID: 2,
};

function mockLoadApis(rules = mockRules.rules, beneficiaries = mockBeneficiaries) {
  apiFetch.mockImplementation(async (url, options) => {
    if (url === '/api/categorization-rules' && !options) return { rules };
    if (url === '/api/tags') return mockTags;
    if (url === '/api/beneficiaries') return beneficiaries;
    if (url === '/api/options/constants') return mockConstants;
    return {};
  });
}

describe('CategorizationRulesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders rules with aliases and formatted tags', async () => {
    mockLoadApis();

    render(<CategorizationRulesTab />);

    expect(await screen.findByText('TestShop -> Food (Groceries)')).toBeInTheDocument();
    expect(screen.getByText('(TS, Test Store)')).toBeInTheDocument();
    expect(screen.getAllByText(/Food \(Groceries\)/).length).toBeGreaterThan(0);

    // All rules: Edit; only user-created rules: Delete
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it('creates a rule with beneficiary search and auto-generated name', async () => {
    mockLoadApis([]);

    apiFetch.mockImplementation(async (url, options) => {
      if (url === '/api/categorization-rules' && !options) return { rules: [] };
      if (url === '/api/tags') return mockTags;
      if (url === '/api/beneficiaries') return mockBeneficiaries;
      if (url === '/api/options/constants') return mockConstants;
      if (url === '/api/categorization-rules' && options?.method === 'POST') {
        return { rule: { uid: 3 } };
      }
      return {};
    });

    render(<CategorizationRulesTab />);

    await waitFor(() => expect(screen.getByText('Add Rule')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Rule'));

    const searchInput = screen.getByPlaceholderText(/Search beneficiary/i);
    fireEvent.change(searchInput, { target: { value: 'New' } });
    fireEvent.focus(searchInput);

    await waitFor(() => expect(screen.getByRole('option', { name: /NewShop/i })).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole('option', { name: /NewShop/i }));

    const tagSelect = screen.getByRole('combobox');
    fireEvent.change(tagSelect, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('NewShop -> Food (Groceries)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/categorization-rules',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"beneficiary_id":20'),
        })
      );
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/categorization-rules',
        expect.objectContaining({
          body: expect.stringContaining('NewShop -> Food (Groceries)'),
        })
      );
    });
  });

  it('deletes a user-created rule', async () => {
    mockLoadApis();

    apiFetch.mockImplementation(async (url, options) => {
      if (url === '/api/categorization-rules' && !options) return mockRules;
      if (url === '/api/tags') return mockTags;
      if (url === '/api/beneficiaries') return mockBeneficiaries;
      if (url === '/api/options/constants') return mockConstants;
      if (url === '/api/categorization-rules/1' && options?.method === 'DELETE') {
        return { status: 'ok' };
      }
      if (url === '/api/categorization-rules' && options === undefined) {
        return { rules: [mockRules.rules[1]] };
      }
      return {};
    });

    window.confirm = vi.fn(() => true);

    render(<CategorizationRulesTab />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/categorization-rules/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
