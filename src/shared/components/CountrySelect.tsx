import { useMemo } from 'react';

import { useCountriesQuery, type CountryOption } from '../api/referenceData';

import { SearchableSelect } from './SearchableSelect';

export const COUNTRY_PREFER_NOT_SAY = '__PREFER_NOT_SAY__';

// Renders `(${country_code}) ${name}` (e.g. "(+91) India") so users see
// the dial-code prefix at a glance — the field also drives the phone
// input's dial-code so this match-up reduces guesswork. Falls back to
// just `${name}` when the metadata row lacks a dial code.
export function formatCountryOption(c: CountryOption): string {
  return c.country_code ? `(${c.country_code}) ${c.name}` : c.name;
}

interface CountrySelectProps {
  id?: string;
  value: string;
  // Receives both the raw select value (so callers can persist
  // `__PREFER_NOT_SAY__` / `''`) and the matched CountryOption (so
  // callers can sync dial code / currency / timezone from the same
  // change in one render). `country` is null for empty + prefer-not-say.
  onChange: (value: string, country: CountryOption | null) => void;
  allowPreferNotSay?: boolean;
  // Optional override — pages that already load countries can pass them
  // in (e.g. RegisterPage's locale-defaulting path needs the list before
  // the user touches the dropdown). Falls back to the shared query.
  countries?: CountryOption[];
}

// Typeahead picker for the country list. Migrated from a plain
// `<select>` in Batch 9.8 — ~250 countries is well past the
// CONTRIBUTING.md §6 "searchable dropdown" threshold (>15 / data-driven
// / no scan-order). Renders the empty + Prefer-not-say sentinels as
// ordinary options at the top of the list.
export function CountrySelect({
  id,
  value,
  onChange,
  allowPreferNotSay = true,
  countries: countriesProp,
}: CountrySelectProps) {
  const { data: countriesQueried = [] } = useCountriesQuery();
  const countries = countriesProp ?? countriesQueried;

  const options = useMemo(() => {
    const head = [{ value: '', label: '— Select country —' }];
    if (allowPreferNotSay) {
      head.push({ value: COUNTRY_PREFER_NOT_SAY, label: 'Rather not say' });
    }
    return [
      ...head,
      ...countries.map((c) => ({
        value: c.name,
        label: formatCountryOption(c),
      })),
    ];
  }, [countries, allowPreferNotSay]);

  return (
    <SearchableSelect
      id={id}
      ariaLabel="Country"
      placeholder="— Select country —"
      value={value}
      options={options}
      onChange={(next) => {
        if (!next || next === COUNTRY_PREFER_NOT_SAY) {
          onChange(next, null);
          return;
        }
        const matched = countries.find((c) => c.name === next) ?? null;
        onChange(next, matched);
      }}
    />
  );
}
