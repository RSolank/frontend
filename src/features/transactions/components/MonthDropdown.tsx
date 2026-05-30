import { useMemo } from 'react';

import { formatYearMonth } from '../../../shared/utils/dateUtils';

interface MonthDropdownProps {
  value: string; // 'YYYY-MM' or '' for All months
  onChange: (next: string) => void;
}

// Rolling 24-month dropdown + "All months". No backend dependency —
// the list is computed against "today" in the browser tz. If a user's
// transaction history extends past 24 months, they can still type a
// raw YYYY-MM in the address bar; the dropdown just doesn't include
// those months explicitly. Backend follow-up — return
// `available_months[]` — is filed but not blocking.
//
// The dropdown intentionally avoids `<input type="month">`. That
// control renders inconsistently across browsers (Firefox shows a
// proper picker, Chrome shows a search-bar-shaped input that's been
// confusing). A plain `<select>` is predictable everywhere.
function buildOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: '', label: 'All months' },
  ];
  const today = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1, 12)
    );
    const ym = `${d.getUTCFullYear().toString().padStart(4, '0')}-${(
      d.getUTCMonth() + 1
    )
      .toString()
      .padStart(2, '0')}`;
    opts.push({ value: ym, label: formatYearMonth(ym, 'short') });
  }
  return opts;
}

export function MonthDropdown({ value, onChange }: MonthDropdownProps) {
  const options = useMemo(buildOptions, []);
  return (
    <select
      aria-label="Select month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-input !w-auto"
    >
      {options.map((o) => (
        <option key={o.value || 'all'} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
