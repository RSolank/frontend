import { useMemo, useState } from 'react';

import {
  getAllTimezones,
  getBrowserTimezone,
  getTimezonesForCountryName,
} from '../../../shared/utils/countryTimezones';

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
}

export function TimezoneSelect({
  countryName,
  countryDefaultTimezone,
  value,
  onChange,
  id,
  required,
}: TimezoneSelectProps) {
  const [showFallback, setShowFallback] = useState(false);

  const allTimezones = useMemo(() => getAllTimezones(), []);
  const countryTimezones = useMemo(
    () => getTimezonesForCountryName(countryName),
    [countryName]
  );

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
          value={tz}
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
    const initial =
      value && countryTimezones.includes(value)
        ? value
        : countryDefaultTimezone && countryTimezones.includes(countryDefaultTimezone)
          ? countryDefaultTimezone
          : countryTimezones[0];
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
              {tz}
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
          {tz}
        </option>
      ))}
    </select>
  );
}
