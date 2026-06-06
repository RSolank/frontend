import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
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
});
