// Pure helpers for the Calendar view. All date math is wall-clock in
// the user's tz. Weeks are ISO 8601 (Mon → Sun) per the project
// convention locked 2026-05-28 (see CONTRIBUTING.md §6 +
// `features/taxation/api/billPeriod.ts`). The visual calendar uses
// the same orientation as the billing engine — one convention across
// the app keeps users from re-translating week boundaries in their
// head when they switch from the transactions browser to bill
// generation.
//
// The week math is reimplemented locally rather than imported from
// `billPeriod.ts` because the visual grid does not need the tz-aware
// `Intl` round-trip — `monthKey` is already tz-resolved by the
// caller. Keeping it local also lets the two surfaces evolve
// independently if (e.g.) the billing engine ever bills on a
// fortnightly cadence.

export interface CalendarCell {
  // `YYYY-MM-DD` in the user's tz. Stable cell identity.
  iso: string;
  year: number;
  month: number; // 1-12
  day: number;
  inMonth: boolean; // false for leading/trailing pad days
  isToday: boolean;
  weekday: number; // 0 = Mon … 6 = Sun
}

function ymdInTz(
  date: Date,
  tz: string
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [y, m, d] = parts.split('-').map(Number);
  return { year: y as number, month: m as number, day: d as number };
}

function isoFromYmd(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function shiftDays(year: number, month: number, day: number, delta: number) {
  const utc = Date.UTC(year, month - 1, day) + delta * 86_400_000;
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

// Monday on/before the given Y-M-D. JS `getUTCDay()` returns
// 0 = Sun … 6 = Sat; the shift to the ISO column-0 Monday is
// `-((dow + 6) % 7)` (Sun → -6, Mon → 0, Tue → -1, …).
function mondayWeekStart(year: number, month: number, day: number) {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const back = (dow + 6) % 7;
  return shiftDays(year, month, day, -back);
}

// Build the calendar grid for `monthKey` (`YYYY-MM`) padded out to
// full ISO weeks so the rendered grid is rectangular: top row starts
// on the first Monday at/before day 1; bottom row ends on the last
// Sunday at/after the last day. Always 6 rows × 7 cols = 42 cells —
// keeps the grid layout stable across months.
export function buildMonthGrid(
  monthKey: string,
  todayIso: string
): CalendarCell[] {
  const [y, m] = monthKey.split('-').map(Number);
  const year = y as number;
  const month = m as number;
  const start = mondayWeekStart(year, month, 1);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const c = shiftDays(start.year, start.month, start.day, i);
    const iso = isoFromYmd(c.year, c.month, c.day);
    cells.push({
      iso,
      year: c.year,
      month: c.month,
      day: c.day,
      inMonth: c.year === year && c.month === month,
      isToday: iso === todayIso,
      weekday: i % 7,
    });
  }
  return cells;
}

// Build the active ISO Mon → Sun row (7 cells) anchored on the
// calendar day containing `anchorIso`. Used by the mobile swipeable
// weekly view.
export function buildWeekRow(
  anchorIso: string,
  todayIso: string
): CalendarCell[] {
  const [ay, am, ad] = anchorIso.split('-').map(Number);
  const start = mondayWeekStart(ay as number, am as number, ad as number);
  const cells: CalendarCell[] = [];
  const [cy, cm] = (anchorIso.match(/^(\d{4})-(\d{2})/)?.slice(1) ?? []).map(
    Number
  );
  for (let i = 0; i < 7; i++) {
    const c = shiftDays(start.year, start.month, start.day, i);
    const iso = isoFromYmd(c.year, c.month, c.day);
    cells.push({
      iso,
      year: c.year,
      month: c.month,
      day: c.day,
      inMonth: c.year === cy && c.month === cm,
      isToday: iso === todayIso,
      weekday: i,
    });
  }
  return cells;
}

// Shift a `YYYY-MM` key by N months. Returns a new key.
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = (y as number) * 12 + ((m as number) - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny.toString().padStart(4, '0')}-${nm.toString().padStart(2, '0')}`;
}

// Shift a `YYYY-MM-DD` ISO date by N days, returning the new ISO date.
export function shiftIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const next = shiftDays(y as number, m as number, d as number, delta);
  return isoFromYmd(next.year, next.month, next.day);
}

// Extract `YYYY-MM` from a `YYYY-MM-DD` ISO date.
export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

// Today as `YYYY-MM-DD` in the user's timezone. Wraps the local-tz
// trick from `shared/utils/dateUtils.todayInUserTz` so calendar
// callers don't import across features just for this.
export function todayIsoInTz(tz: string): string {
  const p = ymdInTz(new Date(), tz);
  return isoFromYmd(p.year, p.month, p.day);
}

// Bucket transactions by date — returns a map keyed on `YYYY-MM-DD`.
// Each bucket carries the totals split debit/credit so the cell can
// show both. Caller is responsible for tz parity (txn_date strings
// should already be local-tz dates from the backend or be normalised
// upstream).
export interface DayBucket {
  iso: string;
  debit_total: number;
  credit_total: number;
  debit_count: number;
  credit_count: number;
  // True when any txn on this day settled a recurring bill — drives the
  // calendar's recurring marker.
  has_recurring: boolean;
}

interface MinimalTxn {
  txn_date: string;
  amount: number;
  debit_credit: 'debit' | 'credit';
  recurring_template_id?: number | null;
}

export function bucketByDay<T extends MinimalTxn>(
  txns: T[],
  tz: string
): Map<string, DayBucket> {
  const out = new Map<string, DayBucket>();
  for (const t of txns) {
    // The backend stores `txn_date` as a `YYYY-MM-DD` string (no
    // time component for manual entries; statement rows may carry a
    // full timestamp). Normalise to YMD in the active tz so a
    // late-evening txn in Asia/Kolkata buckets to the IST day, not
    // the UTC day. If the string is already YMD-only, slice; if it
    // carries a timestamp, run it through Intl.
    let iso: string;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.txn_date)) {
      iso = t.txn_date;
    } else {
      const d = new Date(t.txn_date);
      if (isNaN(d.getTime())) continue;
      iso = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    }
    let bucket = out.get(iso);
    if (!bucket) {
      bucket = {
        iso,
        debit_total: 0,
        credit_total: 0,
        debit_count: 0,
        credit_count: 0,
        has_recurring: false,
      };
      out.set(iso, bucket);
    }
    if (t.debit_credit === 'debit') {
      bucket.debit_total += Math.abs(t.amount);
      bucket.debit_count += 1;
    } else {
      bucket.credit_total += Math.abs(t.amount);
      bucket.credit_count += 1;
    }
    if (t.recurring_template_id != null) bucket.has_recurring = true;
  }
  return out;
}

// Map a per-day debit total to a heat-map intensity 0..4. Bucket
// thresholds are quartiles of the non-zero debit totals so a quiet
// month with one big day doesn't wash everything else to grey. Pass
// `max` from a precomputed max over the displayed range.
export function heatBucket(debitTotal: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (debitTotal <= 0 || max <= 0) return 0;
  const ratio = debitTotal / max;
  if (ratio < 0.2) return 1;
  if (ratio < 0.45) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}
