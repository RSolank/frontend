// Week-period helpers for the consumption-tax surfaces and any other
// frontend surface that needs to bucket data by week (Tax Tracker,
// Dashboard week widgets, /transactions calendar view).
//
// PROJECT CONVENTION: weeks are ISO 8601 — Monday through Sunday in
// the user's active timezone. Locked 2026-05-28 during Batch 9.6; see
// `docs/conventions.md` "Week convention". Backend matches since
// Phase 2.6 (`e7c05aa`) — see `task-platform.md → taxation.iso-week-convention`.
//
// All boundary math is done against the user's timezone so e.g. a
// user in Asia/Kolkata on Sunday evening UTC reads as Monday-in-IST
// and the previous Monday roots the week. Mirrors the wall-clock-in-tz
// strategy from shared/utils/dateUtils.localToUtcIso.

function partsInTz(
  date: Date,
  tz: string
): { year: number; month: number; day: number; weekday: number } {
  // weekday from `weekday: 'short'` lets us derive the Monday-rooted
  // week start without depending on getDay() in local tz. We remap to
  // ISO weekday numbering (Mon=0..Sun=6) so the back-shift to the
  // preceding Monday is a simple subtraction.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const lookup = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  // Monday-rooted: Mon=0, Tue=1, …, Sun=6.
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
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
  // UTC math then read back as Y-M-D; safe because the shift is
  // calendar-day arithmetic, not wall-clock.
  const utc = Date.UTC(year, month - 1, day) + delta * 86_400_000;
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

// Returns the ISO (Monday-rooted) week containing `date` interpreted
// in `tz`. Both fields are `YYYY-MM-DD`. period_start is the Monday,
// period_end is the Sunday.
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

// Returns the start of the preceding ISO week (Monday). Used by the
// bills page to gate "Generate" eligibility: the backend rejects
// period ends that fall inside or after the preceding week (the
// current accruing week is never billable; the preceding one is
// reserved as the in-flight to-be-billed week).
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
export function formatBillDate(
  value: string | null | undefined,
  tz: string
): string {
  if (!value) return '—';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
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

// Fraction-of-the-week-elapsed in user tz under ISO weeks. 0 at
// Monday 00:00; 1 at Sunday 24:00. Used by the Tax Tracker
// projection card when the backend hasn't supplied a server-side
// projection.
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
  return Math.min(
    1,
    Math.max(1 / (7 * 24 * 3600), elapsedSeconds / (7 * 86400))
  );
}
