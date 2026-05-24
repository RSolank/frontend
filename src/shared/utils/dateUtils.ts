// Per CONTRIBUTING.md §5: every user-facing date/time goes through one
// of these helpers, every one of which accepts a `tz` (IANA timezone)
// so the active timezone from usePreferencesStore reaches
// Intl.DateTimeFormat's `timeZone` option. Never call
// `new Date(iso).toLocaleDateString()` from a component — that drops
// the tz entirely.

const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const DEFAULT_DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function safeDate(isoString: string | null | undefined): Date | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? null : d;
}

// Render an ISO date/datetime in the user's timezone with sensible
// defaults. `tz` is required so component code can't forget it.
export function formatDate(
  isoString: string | null | undefined,
  tz: string,
  opts: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTS
): string {
  const d = safeDate(isoString);
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(
    d
  );
}

export function formatDateTime(
  isoString: string | null | undefined,
  tz: string,
  opts: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTS
): string {
  const d = safeDate(isoString);
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(
    d
  );
}

// Default value for <input type="date"> — must be the local-tz YYYY-MM-DD
// for "today". `new Date().toISOString().split('T')[0]` is wrong for
// users east of UTC after ~6 PM local: it returns *tomorrow* in UTC.
// Uses the Intl `en-CA` locale because that locale's date format is
// already ISO-shape (YYYY-MM-DD), so no string surgery needed.
export function todayInUserTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Inverse of the date-input flow: take a `YYYY-MM-DD` from the user
// (interpreted in their tz) and produce an ISO string the backend can
// store. The trick is that `new Date('YYYY-MM-DD')` parses as UTC
// midnight, but we want midnight in the user's tz.
//
// Strategy: compute the offset that tz has from UTC at the given date,
// then subtract it from the UTC midnight reading. Handles DST because
// the offset is looked up at that specific date.
export function localToUtcIso(localDateString: string, tz: string): string {
  // Parse user-entered date as if it were UTC midnight.
  const asUtcMidnight = new Date(`${localDateString}T00:00:00Z`);
  if (isNaN(asUtcMidnight.getTime())) {
    throw new Error(`Invalid date string: ${localDateString}`);
  }
  // Look up that instant's wall-clock in the user's tz.
  const tzWall = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(asUtcMidnight);
  const part = (t: string) => tzWall.find((p) => p.type === t)?.value ?? '00';
  // Reassemble that wall-clock as a UTC instant, then the difference is
  // the tz offset at that date.
  const wallAsUtc = Date.UTC(
    Number(part('year')),
    Number(part('month')) - 1,
    Number(part('day')),
    Number(part('hour') === '24' ? '00' : part('hour')),
    Number(part('minute')),
    Number(part('second'))
  );
  const offsetMs = wallAsUtc - asUtcMidnight.getTime();
  // The user's midnight in tz is `asUtcMidnight - offsetMs`.
  return new Date(asUtcMidnight.getTime() - offsetMs).toISOString();
}

// Legacy helpers retained for callers under src/pages/** that haven't
// migrated. New code uses formatDate / formatDateTime (which require a
// tz). Feature batches replace each call site as they convert the
// containing page.

export function formatDisplayDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatInputDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0] ?? '';
  } catch {
    return '';
  }
}
