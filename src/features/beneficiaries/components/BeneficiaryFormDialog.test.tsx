import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';
import type { Beneficiary } from '../api/queries';

import { BeneficiaryFormDialog } from './BeneficiaryFormDialog';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the save-label
// nested-ternary refactor (no colocated test existed). Pins the create- vs
// edit-mode button label. Round-2 extends it to lock the consolidated
// `canSave` gate that replaced the inline disabled predicate when the
// view-model hook (`useBeneficiaryForm`) was extracted.

const EXISTING: Beneficiary = {
  uid: 1,
  name: 'Amazon',
  aliases: [],
  beneficiary_type: 'merchant',
};

describe('BeneficiaryFormDialog', () => {
  it('labels the save button "Save beneficiary" when creating', () => {
    renderWithProviders(
      <BeneficiaryFormDialog open onClose={vi.fn()} onSaved={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: 'Save beneficiary' })
    ).toBeInTheDocument();
  });

  it('labels the save button "Save changes" when editing', () => {
    renderWithProviders(
      <BeneficiaryFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        beneficiary={EXISTING}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Save changes' })
    ).toBeInTheDocument();
  });

  it('disables Save when creating with an empty name', () => {
    renderWithProviders(
      <BeneficiaryFormDialog open onClose={vi.fn()} onSaved={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: 'Save beneficiary' })
    ).toBeDisabled();
  });

  it('enables Save when creating with a pre-filled name', () => {
    renderWithProviders(
      <BeneficiaryFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        initialName="Netflix"
      />
    );
    expect(
      screen.getByRole('button', { name: 'Save beneficiary' })
    ).toBeEnabled();
  });

  it('disables Save when editing a pristine (not-yet-dirty) beneficiary', () => {
    renderWithProviders(
      <BeneficiaryFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        beneficiary={EXISTING}
      />
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  // Pins T-nav-ia-reorg #6: a person carries its category only on the
  // categorization rule (no person.category column), so the dialog seeds it
  // ASYNC on open. That seed is persisted state, not a user edit, and must NOT
  // mark the form dirty — otherwise a no-op edit raises the discard confirm.
  it('does not mark a person edit dirty when its category is rule-seeded', async () => {
    const PERSON: Beneficiary = {
      uid: 5,
      name: 'Alice',
      aliases: [],
      beneficiary_type: 'person',
    };
    server.use(
      http.get(`${API_BASE}/categorization-rules`, () =>
        HttpResponse.json({
          rules: [{ uid: 10, beneficiary_id: 5, tag_ids: [3] }],
        })
      ),
      http.get(`${API_BASE}/beneficiaries/relationships`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/tags`, () => HttpResponse.json({ tags: [] }))
    );

    renderWithProviders(
      <BeneficiaryFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        beneficiary={PERSON}
      />
    );

    // Wait for the rule to load + seed (the assigned-tag chips appear once
    // ruleTags is set), then confirm the form is still pristine: the dismiss
    // label stays "Close" — it never flips to the dirty-state "Cancel".
    await screen.findByText('Assigned Tags');
    expect(
      screen.queryByRole('button', { name: 'Cancel' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  // Pins T-nav-ia-reorg #6 stale-form race: a person carries its category only
  // on its async rule fetch. On a FAST switch the previous beneficiary's fetch
  // can resolve AFTER the switch and — because the dialog's `setForm` /
  // `onSyncBaselineCategory` write shared form state, not the (remounted)
  // child's — seed the OLD category + tags onto the new one. The effect's
  // cancel guard must drop the stale resolution. (Keying the child alone does
  // NOT fix this — the parent setter outlives the unmount.)
  it('does not bleed the previous beneficiary category/tags after a fast switch', async () => {
    const ALICE: Beneficiary = {
      uid: 5,
      name: 'Alice',
      aliases: [],
      beneficiary_type: 'person',
    };
    const BOB: Beneficiary = {
      uid: 6,
      name: 'Bob',
      aliases: [],
      beneficiary_type: 'person',
    };

    // Gate Alice's rule fetch so it lands only AFTER we've switched to Bob.
    let releaseAlice = () => {};
    const aliceGate = new Promise<void>((r) => {
      releaseAlice = r;
    });
    let calls = 0;
    server.use(
      http.get(`${API_BASE}/categorization-rules`, async () => {
        calls += 1;
        if (calls === 1) await aliceGate;
        // Alice (uid 5) → Rent (tag 3); Bob (uid 6) has no rule.
        return HttpResponse.json({
          rules: [{ uid: 10, beneficiary_id: 5, tag_ids: [3] }],
        });
      }),
      http.get(`${API_BASE}/beneficiaries/relationships`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/tags`, () =>
        HttpResponse.json({
          tags: [{ tag_id: 3, tag_name: 'Rent', parent: null, children: [] }],
        })
      )
    );

    const { rerender } = renderWithProviders(
      <BeneficiaryFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        beneficiary={ALICE}
      />
    );

    // Switch to Bob before Alice's fetch resolves, then release the stale one.
    rerender(
      <BeneficiaryFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        beneficiary={BOB}
      />
    );
    await screen.findByText('Bob');
    // Bob's reserved chip row is present once his fields mount.
    await screen.findByText('Assigned Tags');
    // At least Alice's gated fetch + Bob's fetch are in flight.
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(2));
    await act(async () => {
      releaseAlice();
      // Let every in-flight resolution (incl. the stale uid=5 ones) + the
      // client promise chains settle; the cancel guard must drop them so
      // nothing is seeded onto Bob.
      await new Promise((r) => setTimeout(r, 30));
    });

    // Bob must never inherit Alice's Rent (tag 3) chip.
    expect(screen.queryByText('Rent')).not.toBeInTheDocument();
  });
});
