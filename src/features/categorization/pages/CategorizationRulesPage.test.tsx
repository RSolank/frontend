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
        {
          tag_id: 13,
          tag_name: 'Dining',
          parent: 10,
          tag_type: 'discretionary',
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

// Two rules with distinct tag-sets → both render as singleton cards
// (matches the pre-grouping render so the basic assertions stay
// readable). A dedicated grouping test below uses a multi-rule bucket.
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
      rule_name: 'Reliance Fresh -> Refunds',
      beneficiary_id: 1,
      beneficiary_name: 'Reliance Fresh',
      beneficiary_aliases: [],
      tag_ids: [15],
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

    // Singleton cards: Edit shows for every rule; Delete only on
    // user-owned rules (rule 2 has created_by === SYSTEM_USER_ID).
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

    // One-click tag selection: dropdown onChange appends the tag
    // immediately (no Add button anymore). The select resets to its
    // "＋ Add a tag…" prompt afterwards.
    const tagSelect = screen.getByRole('combobox', { name: /Add a tag/i });
    fireEvent.change(tagSelect, { target: { value: '12' } });

    // Rule name is now a computed text display (not an input), so
    // assert via getByText. The text appears inside the <output>
    // element wired to the form's beneficiary + tag selections.
    await waitFor(() =>
      expect(
        screen.getByText('NewShop -> Food (Groceries)')
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

  it('groups rules with the same tag-set into a collapsible header', async () => {
    // Three rules sharing tag_ids [12] → one multi-rule group.
    server.use(
      http.get('http://localhost:4000/api/categorization-rules', () =>
        HttpResponse.json({
          rules: [
            {
              uid: 1,
              rule_name: 'A -> Food (Groceries)',
              beneficiary_id: 1,
              beneficiary_name: 'AlphaMart',
              beneficiary_aliases: [],
              tag_ids: [12],
              notes: null,
              created_by: 1,
            },
            {
              uid: 2,
              rule_name: 'B -> Food (Groceries)',
              beneficiary_id: 2,
              beneficiary_name: 'BetaMart',
              beneficiary_aliases: [],
              tag_ids: [12],
              notes: null,
              created_by: 1,
            },
            {
              uid: 3,
              rule_name: 'C -> Food (Groceries)',
              beneficiary_id: 3,
              beneficiary_name: 'CharlieMart',
              beneficiary_aliases: [],
              tag_ids: [12],
              notes: null,
              created_by: 1,
            },
          ],
        })
      )
    );

    renderWithProviders(<CategorizationRulesPage />);

    // Collapsed state: group header shows the chip set + the count;
    // individual beneficiary names are NOT yet visible.
    const header = await screen.findByText(/Applied to 3 beneficiaries/i);
    expect(header).toBeInTheDocument();
    expect(screen.queryByText('AlphaMart')).not.toBeInTheDocument();

    // Click the group header to expand.
    const expandBtn = header.closest('button');
    expect(expandBtn).not.toBeNull();
    fireEvent.click(expandBtn!);

    expect(await screen.findByText('AlphaMart')).toBeInTheDocument();
    expect(screen.getByText('BetaMart')).toBeInTheDocument();
    expect(screen.getByText('CharlieMart')).toBeInTheDocument();
  });

  it('rule name uses only the primary tag and updates as the primary changes', async () => {
    // Empty rule list so the form's beneficiary slot can take any
    // option (no existing-rule conflict).
    server.use(
      http.get('http://localhost:4000/api/categorization-rules', () =>
        HttpResponse.json({ rules: [] })
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
    fireEvent.change(searchInput, { target: { value: 'NewShop' } });
    fireEvent.focus(searchInput);
    fireEvent.mouseDown(
      await screen.findByRole('option', { name: /NewShop/i })
    );

    // Progressive: beneficiary alone shows just the name (no arrow).
    expect(await screen.findByText('NewShop')).toBeInTheDocument();

    // Pick a primary tag → name fills in.
    const tagSelect = screen.getByRole('combobox', { name: /Add a tag/i });
    fireEvent.change(tagSelect, { target: { value: '12' } });
    expect(
      await screen.findByText('NewShop -> Food (Groceries)')
    ).toBeInTheDocument();

    // Add a second tag — rule name MUST stay on the primary (12).
    // (The secondary tag IS rendered as a chip in the picker widget;
    // we only assert that the rule-name <output> still shows the
    // primary's label, not that "Dining" is absent from the DOM.)
    fireEvent.change(tagSelect, { target: { value: '13' } });
    expect(
      await screen.findByText('NewShop -> Food (Groceries)')
    ).toBeInTheDocument();

    // Promote tag 13 to primary via its chip's "Set Primary" button.
    // tag 13 ("Dining") is rendered as the non-primary chip with a
    // Set Primary affordance.
    const promoteBtns = screen.getAllByRole('button', { name: 'Set Primary' });
    fireEvent.click(promoteBtns[0]!);
    expect(
      await screen.findByText('NewShop -> Food (Dining)')
    ).toBeInTheDocument();

    // Now remove the new primary (13) via its chip ×. Tag 12 should
    // auto-reassume primary at index 0 — name reverts to Groceries.
    const removeBtn = screen.getByRole('button', {
      name: /Remove tag Food \(Dining\)/i,
    });
    fireEvent.click(removeBtn);
    expect(
      await screen.findByText('NewShop -> Food (Groceries)')
    ).toBeInTheDocument();
  });

  it('shows section headings + Show N more disclosure when bands exceed cap', async () => {
    // 17 singletons (>5 cap = 12 hidden) + 9 multi-rule groups
    // (>6 cap = 3 hidden). Each singleton: unique tag id (100..116).
    // Each multi-group: two rules sharing a distinct pair (200/201,
    // 202/203, …).
    const manyRules = [
      ...Array.from({ length: 17 }, (_, i) => ({
        uid: i + 1,
        rule_name: `S${i} -> tag${100 + i}`,
        beneficiary_id: i + 1,
        beneficiary_name: `Singleton${i}`,
        beneficiary_aliases: [],
        tag_ids: [100 + i],
        notes: null,
        created_by: 1,
      })),
      ...Array.from({ length: 18 }, (_, i) => {
        const pairIdx = Math.floor(i / 2);
        return {
          uid: 1000 + i,
          rule_name: `G${i}`,
          beneficiary_id: 1000 + i,
          beneficiary_name: `GroupMember${i}`,
          beneficiary_aliases: [],
          tag_ids: [200 + pairIdx * 2, 201 + pairIdx * 2],
          notes: null,
          created_by: 1,
        };
      }),
    ];

    server.use(
      http.get('http://localhost:4000/api/categorization-rules', () =>
        HttpResponse.json({ rules: manyRules })
      )
    );

    renderWithProviders(<CategorizationRulesPage />);

    // Section headings render whenever the band has entries —
    // independent of whether the other band exists.
    expect(
      await screen.findByText(/Standalone rules/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Grouped rules/i)).toBeInTheDocument();

    // 17 singletons − 5 visible = 12 hidden.
    expect(
      screen.getByRole('button', { name: 'Show 12 more' })
    ).toBeInTheDocument();
    // 9 groups − 6 visible = 3 hidden.
    expect(
      screen.getByRole('button', { name: 'Show 3 more' })
    ).toBeInTheDocument();
  });

  it('renders the Standalone rules heading even when there are no grouped rules', async () => {
    // Two singletons, no multi-rule groups. The Standalone heading
    // should still render (seed-data-friendly behavior).
    server.use(
      http.get('http://localhost:4000/api/categorization-rules', () =>
        HttpResponse.json({
          rules: [
            {
              uid: 1,
              rule_name: 'A -> Food (Groceries)',
              beneficiary_id: 1,
              beneficiary_name: 'AlphaMart',
              beneficiary_aliases: [],
              tag_ids: [12],
              notes: null,
              created_by: 1,
            },
            {
              uid: 2,
              rule_name: 'B -> Refunds',
              beneficiary_id: 2,
              beneficiary_name: 'BetaMart',
              beneficiary_aliases: [],
              tag_ids: [15],
              notes: null,
              created_by: 1,
            },
          ],
        })
      )
    );

    renderWithProviders(<CategorizationRulesPage />);

    expect(
      await screen.findByText(/Standalone rules/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Grouped rules/i)).not.toBeInTheDocument();
  });

  it('opens the create-beneficiary dialog from the dropdown CTA', async () => {
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
    fireEvent.change(searchInput, { target: { value: 'Swiggy' } });
    fireEvent.focus(searchInput);

    const ctaButton = await screen.findByRole('button', {
      name: /Add new beneficiary/i,
    });
    fireEvent.mouseDown(ctaButton);

    // Dialog is portaled. Its title + the pre-filled Name field
    // should appear.
    const dialog = await screen.findByRole('dialog', {
      name: /Add new beneficiary/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Swiggy');
  });
});
