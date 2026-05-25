import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { CategorizationRulesPage } from './CategorizationRulesPage';

const tagsResponse = {
  tags: [
    {
      tag_id: 10,
      tag_name: 'Food',
      parent: null,
      tag_type: 'essential',
      aliases: [],
      created_by: null,
      children: [
        {
          tag_id: 12,
          tag_name: 'Groceries',
          parent: 10,
          tag_type: 'essential',
          aliases: [],
          created_by: null,
          children: [],
        },
      ],
    },
    {
      tag_id: 15,
      tag_name: 'Refunds',
      parent: null,
      tag_type: 'income',
      aliases: [],
      created_by: null,
      children: [],
    },
  ],
};

const beneficiariesResponse = [
  {
    uid: 10,
    name: 'TestShop',
    aliases: ['TS', 'Test Store'],
    beneficiary_type: 'merchant',
  },
  {
    uid: 20,
    name: 'NewShop',
    aliases: [],
    beneficiary_type: 'merchant',
  },
];

const rulesResponse = {
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

const constants = {
  SYSTEM_USER_ID: 0,
  TOTAL_TAG_ID: 1,
  MISCELLANEOUS_TAG_ID: 2,
  CONSUMPTION_TAX_TAG_ID: 3,
};

beforeEach(() => {
  server.use(
    http.get('http://localhost:4000/api/categorization-rules', () =>
      HttpResponse.json(rulesResponse)
    ),
    http.get('http://localhost:4000/api/tags', () =>
      HttpResponse.json(tagsResponse)
    ),
    http.get('http://localhost:4000/api/beneficiaries', () =>
      HttpResponse.json(beneficiariesResponse)
    ),
    http.get('http://localhost:4000/api/metadata/constants', () =>
      HttpResponse.json(constants)
    )
  );
});

describe('CategorizationRulesPage', () => {
  it('renders rules with aliases and formatted tags', async () => {
    renderWithProviders(<CategorizationRulesPage />);

    expect(
      await screen.findByText('TestShop -> Food (Groceries)')
    ).toBeInTheDocument();
    expect(screen.getByText('(TS, Test Store)')).toBeInTheDocument();
    expect(screen.getAllByText(/Food \(Groceries\)/).length).toBeGreaterThan(0);

    // Edit is offered for every rule; Delete only on user-owned rules
    // (rule 2 has created_by === SYSTEM_USER_ID).
    expect(await screen.findAllByRole('button', { name: 'Edit' })).toHaveLength(
      2
    );
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it('creates a rule with beneficiary search and auto-generated name', async () => {
    const postSpy = vi.fn();
    server.use(
      http.get('http://localhost:4000/api/categorization-rules', () =>
        HttpResponse.json({ rules: [] })
      ),
      http.post(
        'http://localhost:4000/api/categorization-rules',
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          postSpy(body);
          return HttpResponse.json({ rule: { uid: 3 } });
        }
      )
    );

    renderWithProviders(<CategorizationRulesPage />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Rule' })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }));

    const searchInput = await screen.findByPlaceholderText(
      /Search beneficiary/i
    );
    fireEvent.change(searchInput, { target: { value: 'New' } });
    fireEvent.focus(searchInput);

    const option = await screen.findByRole('option', { name: /NewShop/i });
    fireEvent.mouseDown(option);

    const tagSelect = screen.getByRole('combobox', { name: /Select tag/i });
    fireEvent.change(tagSelect, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(
        screen.getByDisplayValue('NewShop -> Food (Groceries)')
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create Rule' }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'NewShop -> Food (Groceries)',
          beneficiary_id: 20,
          tag_ids: [12],
        })
      );
    });
  });

  it('deletes a user-created rule via the API', async () => {
    const deleteSpy = vi.fn();
    server.use(
      http.delete(
        'http://localhost:4000/api/categorization-rules/1',
        () => {
          deleteSpy();
          return HttpResponse.json({ status: 'ok' });
        }
      )
    );

    window.confirm = vi.fn(() => true);

    renderWithProviders(<CategorizationRulesPage />);

    const deleteBtn = await screen.findByRole('button', { name: 'Delete' });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });
  });
});
