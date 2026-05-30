import { useMemo } from 'react';

import { useCurrenciesQuery, type CurrencyOption } from '../api/referenceData';

import { SearchableSelect } from './SearchableSelect';

interface CurrencySelectProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  // Optional override; falls back to the shared query.
  currencies?: CurrencyOption[];
}

// Renders `${label} (${symbol})` (label already carries "CODE - Name"
// from the backend, e.g. "INR - Indian Rupee"). Falls back to just
// `${label}` when the metadata row lacks a symbol. The full name keeps
// the dropdown readable for users who don't recognise every ISO code.
export function formatCurrencyOption(c: CurrencyOption): string {
  return c.symbol ? `${c.label} (${c.symbol})` : c.label;
}

// Typeahead picker for the currency list. Migrated from a plain
// `<select>` in Batch 9.8 — ~170 currencies is well past the
// CONTRIBUTING.md §6 "searchable dropdown" threshold.
export function CurrencySelect({
  id,
  value,
  onChange,
  currencies: currenciesProp,
}: CurrencySelectProps) {
  const { data: currenciesQueried = [] } = useCurrenciesQuery();
  const currencies = currenciesProp ?? currenciesQueried;

  const options = useMemo(
    () => [
      { value: '', label: '— Select currency —' },
      ...currencies.map((c) => ({
        value: c.code,
        label: formatCurrencyOption(c),
      })),
    ],
    [currencies]
  );

  return (
    <SearchableSelect
      id={id}
      ariaLabel="Currency"
      placeholder="— Select currency —"
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}
