import { useMemo, useState } from 'react';

import {
  formatTimezoneOption,
  getAllTimezones,
  getBrowserTimezone,
  getTimezonesForCountryName,
} from '../utils/countryTimezones';

interface TimezoneSelectProps {
  // Selected country's display name (e.g. "India"). Drives whether we
  // render a read-only field, a country-scoped dropdown, or the full
  // IANA list.
  countryName: string | null;
  // The metadata API's default tz for the selected country (singular
  // `timezone` field from /api/metadata/countries). Used as the initial
  // value for multi-timezone countries.
  countryDefaultTimezone: string | null;
  value: string;
  onChange: (timezone: string) => void;
  id?: string;
  required?: boolean;
  // When true, skip all country-scoped modes and render the full IANA
  // dropdown directly. The country still informs the initial value
  // (passed via `value`) but the user can pick any of the ~400 IANA
  // zones without an "override" click. Used by the Account /
  // Preferences page so frequent travelers can lock to UTC without
  // changing their country of residence.
  alwaysFullList?: boolean;
}

// Initial tz for a multi-zone country: prefer the current value if it's
// valid for the country, else the country's default, else the first zone.
function pickInitialTimezone(
  value: string,
  countryDefault: string | null,
  options: string[]
): string {
  if (value && options.includes(value)) return value;
  if (countryDefault && options.includes(countryDefault)) return countryDefault;
  return options[0] ?? '';
}

// eslint-disable-next-line complexity -- inherent: renders 4 distinct modes (full-list / single-zone read-only / country-scoped dropdown / fallback) via guard-clause early returns; the branch count reflects real UX states, not tangled logic.
export function TimezoneSelect({
  countryName,
  countryDefaultTimezone,
  value,
  onChange,
  id,
  required,
  alwaysFullList = false,
}: TimezoneSelectProps) {
  const [showFallback, setShowFallback] = useState(false);

  const allTimezones = useMemo(() => getAllTimezones(), []);
  const countryTimezones = useMemo(
    () => getTimezonesForCountryName(countryName),
    [countryName]
  );

  // alwaysFullList consumers skip every country-scoped mode below and
  // fall through to the full IANA dropdown at the bottom.
  if (alwaysFullList) {
    const selected = value || getBrowserTimezone();
    return (
      <select
        id={id}
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="form-input"
      >
        {allTimezones.map((tz) => (
          <option key={tz} value={tz}>
            {formatTimezoneOption(tz)}
          </option>
        ))}
      </select>
    );
  }

  // Country known + has exactly one timezone → read-only display.
  if (
    !showFallback &&
    countryName &&
    countryTimezones.length === 1 &&
    countryTimezones[0]
  ) {
    const tz = countryTimezones[0];
    return (
      <div>
        <input
          id={id}
          type="text"
          value={formatTimezoneOption(tz)}
          readOnly
          aria-readonly
          className="form-input"
        />
        <button
          type="button"
          onClick={() => {
            setShowFallback(true);
            onChange(tz);
          }}
          className="btn-link !w-auto !justify-start !px-0 !py-1 !text-xs"
        >
          Use a different timezone
        </button>
      </div>
    );
  }

  // Country known + multiple timezones → dropdown scoped to that country.
  if (!showFallback && countryName && countryTimezones.length > 1) {
    const initial = pickInitialTimezone(
      value,
      countryDefaultTimezone,
      countryTimezones
    );
    return (
      <div>
        <select
          id={id}
          value={initial}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="form-input"
        >
          {countryTimezones.map((tz) => (
            <option key={tz} value={tz}>
              {formatTimezoneOption(tz)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowFallback(true)}
          className="btn-link !w-auto !justify-start !px-0 !py-1 !text-xs"
        >
          Use a different timezone
        </button>
      </div>
    );
  }

  // Fallback / unknown country / explicit override → full IANA dropdown,
  // defaulted to the browser's resolved tz when no value is set yet.
  const selected = value || getBrowserTimezone();
  return (
    <select
      id={id}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="form-input"
    >
      {allTimezones.map((tz) => (
        <option key={tz} value={tz}>
          {formatTimezoneOption(tz)}
        </option>
      ))}
    </select>
  );
}
