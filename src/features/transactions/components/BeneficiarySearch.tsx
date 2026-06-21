import { useMemo } from 'react';

import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import type { Beneficiary } from '../../beneficiaries/api/queries';

interface BeneficiarySearchProps {
  // Display name of the currently-selected beneficiary (a fallback label so
  // the selection still shows when the loaded list doesn't include it yet).
  value: string;
  beneficiaryId: number | string;
  beneficiaries: Beneficiary[];
  // Emits the chosen (name, id) pair, or ('', '') when cleared.
  onChange: (name: string, id: number | string) => void;
  // Optional "+ Add new beneficiary" CTA (Type A). The parent opens a
  // <BeneficiaryFormDialog /> inline; omit to hide the affordance.
  onRequestAddBeneficiary?: () => void;
  // Kept for call-site compatibility — pick-only has no free-text field to
  // mark required (the form validates the selected id on submit).
  required?: boolean;
  disabled?: boolean;
}

// Transaction beneficiary picker — a thin domain wrapper over the shared
// pick-only `SearchableSelect`. Selecting an option emits (name, id); typing
// only filters (free-text entry no longer commits a new beneficiary — use the
// "+ Add new beneficiary" CTA to create one). A synthetic option for the
// current selection guarantees the chosen name shows even when the loaded
// `beneficiaries` list doesn't contain it (e.g. on Edit before it resolves).
export function BeneficiarySearch({
  value,
  beneficiaryId,
  beneficiaries,
  onChange,
  onRequestAddBeneficiary,
  disabled,
}: BeneficiarySearchProps) {
  const options = useMemo(() => {
    const base = beneficiaries.map((b) => ({
      value: String(b.uid),
      label: b.name,
    }));
    if (beneficiaryId && !base.some((o) => o.value === String(beneficiaryId))) {
      base.unshift({ value: String(beneficiaryId), label: value || 'Selected' });
    }
    return base;
  }, [beneficiaries, beneficiaryId, value]);

  return (
    <div>
      <label htmlFor="beneficiary_name" className="form-label">
        Beneficiary
      </label>
      <SearchableSelect
        id="beneficiary_name"
        ariaLabel="Beneficiary"
        placeholder="Search beneficiary..."
        value={beneficiaryId ? String(beneficiaryId) : ''}
        options={options}
        searchable={!disabled}
        onChange={(next) => {
          if (!next) {
            onChange('', '');
            return;
          }
          const b = beneficiaries.find((x) => String(x.uid) === next);
          if (b) onChange(b.name, b.uid);
        }}
        onCreate={
          onRequestAddBeneficiary ? () => onRequestAddBeneficiary() : undefined
        }
        createLabel="Add new beneficiary"
      />
    </div>
  );
}
