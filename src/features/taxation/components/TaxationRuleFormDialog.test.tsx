import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TaxationRule } from '../api/queries';

import { TaxationRuleFormDialog } from './TaxationRuleFormDialog';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the save-label
// nested-ternary refactor (no colocated test existed). Pins the add- vs
// edit-mode button label.

const EXISTING = {
  txn_type: 'essential',
  tax_rate: 0.05,
  default_penalty_rate: 0.5,
} as unknown as TaxationRule;

describe('TaxationRuleFormDialog', () => {
  it('labels the save button "Add rule" in add mode', () => {
    render(
      <TaxationRuleFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        availableTypes={['essential']}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Add rule' })
    ).toBeInTheDocument();
  });

  it('labels the save button "Save changes" in edit mode', () => {
    render(
      <TaxationRuleFormDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        editingRule={EXISTING}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Save changes' })
    ).toBeInTheDocument();
  });
});
