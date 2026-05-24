import { useCountriesQuery, type CountryOption } from '../api/queries';

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
  required?: boolean;
  // Optional override — pages that already load countries can pass them
  // in (e.g. RegisterPage's locale-defaulting path needs the list before
  // the user touches the dropdown). Falls back to the shared query.
  countries?: CountryOption[];
}

export function CountrySelect({
  id,
  value,
  onChange,
  allowPreferNotSay = true,
  required,
  countries: countriesProp,
}: CountrySelectProps) {
  const { data: countriesQueried = [] } = useCountriesQuery();
  const countries = countriesProp ?? countriesQueried;

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (!next || next === COUNTRY_PREFER_NOT_SAY) {
          onChange(next, null);
          return;
        }
        const matched =
          countries.find((c) => c.name === next) ?? null;
        onChange(next, matched);
      }}
      required={required}
      className="form-input"
    >
      <option value="">— Select country —</option>
      {allowPreferNotSay && (
        <option value={COUNTRY_PREFER_NOT_SAY}>Rather not say</option>
      )}
      {countries.map((c) => (
        <option key={c.name} value={c.name}>
          {formatCountryOption(c)}
        </option>
      ))}
    </select>
  );
}
