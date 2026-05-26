// Week-period helpers for the consumption-tax surfaces. Sun–Sat per the
// backend's bill-period convention (see
// backend/app/modules/taxation/taxation_services.py:generate_bill_for_week).
//
// All boundary math is done against the user's timezone so a user in
// Asia/Kolkata on Sunday evening UTC gets Sunday-in-IST as the week
// start, not Monday. The wall-clock-in-tz strategy mirrors
// shared/utils/dateUtils.localToUtcIso.

function partsInTz(
  date: Date,
  tz: string
): { year: number; month: number; day: number; weekday: number } {
  // weekday from `weekday: 'short'` (Sun..Sat) lets us derive the
  // Sun-rooted week start without going through getDay() in local tz.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const lookup = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(lookup('year')),
    month: Number(lookup('month')),
    day: Number(lookup('day')),
    weekday: weekdayMap[lookup('weekday')] ?? 0,
  };
}

function isoFromYmd(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function shiftDays(year: number, month: number, day: number, delta: number) {
  // Use UTC math then read back as Y-M-D; safe because the shift is
  // calendar-day arithmetic, not wall-clock.
  const utc = Date.UTC(year, month - 1, day) + delta * 86_400_000;
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

// Returns the Sunday-rooted week containing `date` interpreted in `tz`.
// Both fields are `YYYY-MM-DD`.
export function weekRangeInTz(
  date: Date,
  tz: string
): { period_start: string; period_end: string } {
  const p = partsInTz(date, tz);
  const start = shiftDays(p.year, p.month, p.day, -p.weekday);
  const end = shiftDays(start.year, start.month, start.day, 6);
  return {
    period_start: isoFromYmd(start.year, start.month, start.day),
    period_end: isoFromYmd(end.year, end.month, end.day),
  };
}

// Returns the start of the preceding week (Sunday). Used by the bills
// page to gate "Generate" eligibility: the backend rejects period ends
// that fall inside or after the preceding week (the current accruing
// week is never billable; the preceding one is reserved as the
// in-flight to-be-billed week).
export function precedingWeekStartInTz(tz: string): string {
  const current = weekRangeInTz(new Date(), tz);
  const [y, m, d] = current.period_start.split('-').map(Number);
  const prev = shiftDays(y as number, m as number, d as number, -7);
  return isoFromYmd(prev.year, prev.month, prev.day);
}

// Bill-page date renderer. Defaults to `dd/mon/yyyy` (e.g.
// "15/Feb/2026") per the 2026-05-26 design-principle lock for the
// taxation surfaces. Accepts either a raw `YYYY-MM-DD` (treated as
// noon UTC to avoid tz-edge surprises) or a full ISO string.
//
// FUTURE: once Batch 9.5's `/account/preferences` page persists a
// user-chosen date format, replace the hardcoded `{day, month, year}`
// pattern below with a lookup from `usePreferencesStore.dateFormat`.
// See the Preferences cluster in the implementation_plan "Backend
// follow-ups" + "Defaults cluster persistence" entries — backend
// columns + hydration ship in Batch 9.5; this helper is the
// single-file swap point on the frontend.
export function formatBillDate(value: string, tz: string): string {
  if (!value) return '—';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00Z`
    : value;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  // `dd/mon/yyyy` shape via `en-GB` short month — Intl emits
  // "15 Feb 2026" by default; we replace spaces with `/` so the
  // format is consistent across locales.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return `${day}/${month}/${year}`;
}

// Fraction-of-the-week-elapsed in user tz. 0 on Sunday 00:00; 1 at
// Saturday 24:00. Used by the Tax Tracker projection card when the
// backend hasn't supplied a server-side projection.
export function fractionOfWeekElapsed(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  // Hours / minutes / seconds in tz.
  const hms = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hh = Number(hms.find((x) => x.type === 'hour')?.value ?? '0');
  const mm = Number(hms.find((x) => x.type === 'minute')?.value ?? '0');
  const ss = Number(hms.find((x) => x.type === 'second')?.value ?? '0');
  const elapsedSeconds = p.weekday * 86400 + hh * 3600 + mm * 60 + ss;
  return Math.min(1, Math.max(1 / (7 * 24 * 3600), elapsedSeconds / (7 * 86400)));
}
