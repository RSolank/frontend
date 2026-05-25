import { useState } from 'react';

import type { Beneficiary } from '../../beneficiaries/api/queries';

interface BeneficiarySearchProps {
  value: string;
  beneficiaryId: number | string;
  beneficiaries: Beneficiary[];
  onChange: (name: string, id: number | string) => void;
  required?: boolean;
  disabled?: boolean;
}

// Type-ahead picker shared by Add + Edit transaction forms. Emits the
// chosen `(name, id)` pair; the page is responsible for nulling the id
// when the user types a new name (so the backend creates a fresh
// beneficiary). "Add New" deliberately opens /beneficiaries in a new
// tab — the user keeps their in-flight transaction draft.
export function BeneficiarySearch({
  value,
  beneficiaryId,
  beneficiaries,
  onChange,
  required,
  disabled,
}: BeneficiarySearchProps) {
  const [focused, setFocused] = useState(false);
  const filtered = beneficiaries.filter(
    (b) => !value || b.name.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="relative">
      <label htmlFor="beneficiary_name" className="form-label">
        Beneficiary
      </label>
      <input
        id="beneficiary_name"
        value={value}
        onChange={(e) => onChange(e.target.value, '')}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder="Search beneficiary..."
        required={required}
        disabled={disabled}
        autoComplete="off"
        className="form-input"
      />
      {focused && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onMouseDown={() => window.open('/beneficiaries', '_blank')}
            className="block w-full px-3 py-2 text-left text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            + Add New
          </button>
          {filtered.map((b) => (
            <button
              key={b.uid}
              type="button"
              onMouseDown={() => onChange(b.name, b.uid)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                b.uid === beneficiaryId
                  ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
