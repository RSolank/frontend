import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Personalization — picks the order and shape of every user-facing
// date rendered through `formatDate` / `formatDateTime` in
// `shared/utils/dateUtils.ts`.
//
// Server-synced after BE Phase 1.9 — the `user_preferences` row's
// `date_format` column is the SoT. Hydrated at boot by
// `hydratePreferences()` and PATCHed back on user-driven setX by
// `subscribeToPreferenceStores()` (see CONTRIBUTING.md §5).
// Zustand `persist` (`localStorage["date-format"]`) is the local
// cache that bridges between cold-boot and the GET response.

export type DateFormatMode =
  | 'system' // Browser locale default, no override.
  | 'dmy' // dd/mm/yyyy
  | 'mdy' // mm/dd/yyyy
  | 'ymd' // yyyy-mm-dd (ISO)
  | 'dmonth'; // dd MMM yyyy (e.g. 27 May 2026)

interface DateFormatState {
  format: DateFormatMode;
  setFormat: (format: DateFormatMode) => void;
}

export const useDateFormatStore = create<DateFormatState>()(
  persist(
    (set) => ({
      format: 'system',
      setFormat: (format) => set({ format }),
    }),
    { name: 'date-format' }
  )
);

// Map a mode to a partial Intl.DateTimeFormatOptions override. Caller
// always merges with the base opts (which carry the `timeZone`), and
// the resulting object is passed straight to Intl.DateTimeFormat.
// Returns null for `'system'` so the caller falls back to its default
// opts.
export function optsForDateFormat(
  format: DateFormatMode
): Intl.DateTimeFormatOptions | null {
  switch (format) {
    case 'dmy':
    case 'mdy':
    case 'ymd':
      // 2-digit numeric all-around; Intl reorders day/month/year by the
      // locale we pass below.
      return { year: 'numeric', month: '2-digit', day: '2-digit' };
    case 'dmonth':
      return { year: 'numeric', month: 'short', day: 'numeric' };
    case 'system':
    default:
      return null;
  }
}

// Locale that produces the requested date-part order under
// Intl.DateTimeFormat with `{year/month/day}` opts. en-GB is dd/mm/yyyy,
// en-US is mm/dd/yyyy, en-CA is yyyy-mm-dd. `'dmonth'` uses the
// browser default locale (the user's textual month preference is
// respected) with the helper's `month: 'short'` opt.
export function localeForDateFormat(
  format: DateFormatMode
): string | undefined {
  switch (format) {
    case 'dmy':
      return 'en-GB';
    case 'mdy':
      return 'en-US';
    case 'ymd':
      return 'en-CA';
    case 'dmonth':
    case 'system':
    default:
      return undefined;
  }
}
