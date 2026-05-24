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

const FALLBACK_INPUT_STYLE = {
  width: '100%',
  padding: '0.5rem',
  marginTop: 4,
} as const;

const READ_ONLY_STYLE = {
  ...FALLBACK_INPUT_STYLE,
  background: '#f5f5f5',
} as const;

const LINK_BUTTON_STYLE = {
  marginTop: 4,
  background: 'transparent',
  border: 'none',
  color: '#2563eb',
  cursor: 'pointer',
  padding: 0,
  fontSize: '0.85rem',
} as const;

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
          style={READ_ONLY_STYLE}
        />
        <button
          type="button"
          onClick={() => {
            setShowFallback(true);
            onChange(tz);
          }}
          style={LINK_BUTTON_STYLE}
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
          style={FALLBACK_INPUT_STYLE}
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
          style={LINK_BUTTON_STYLE}
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
      style={FALLBACK_INPUT_STYLE}
    >
      {allTimezones.map((tz) => (
        <option key={tz} value={tz}>
          {tz}
        </option>
      ))}
    </select>
  );
}
