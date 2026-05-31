import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Personalization — picks the thousands + decimal separator pair used
// by every user-facing amount rendered through `formatMoney` in
// `shared/utils/currency.ts`.
//
// Server-synced after BE Phase 1.9 — the `user_preferences` row's
// `number_format` column is the SoT. Hydrated at boot by
// `hydratePreferences()` and PATCHed back on user-driven setX by
// `subscribeToPreferenceStores()` (see CONTRIBUTING.md §5).
// Zustand `persist` (`localStorage["number-format"]`) is the local
// cache that bridges between cold-boot and the GET response.

export type NumberFormatMode =
  | 'system' // Browser locale default, no override.
  | 'comma-dot' // 1,234.56 — en-US / en-GB style.
  | 'dot-comma' // 1.234,56 — de-DE / es / it style.
  | 'space-comma' // 1 234,56 — fr-FR / sv style.
  | 'indian' // 12,34,567.89 — Indian lakh/crore grouping (en-IN).
  | 'plain'; // 1234.56 — no thousands grouping.

interface NumberFormatState {
  format: NumberFormatMode;
  setFormat: (format: NumberFormatMode) => void;
}

export const useNumberFormatStore = create<NumberFormatState>()(
  persist(
    (set) => ({
      format: 'system',
      setFormat: (format) => set({ format }),
    }),
    { name: 'number-format' }
  )
);

// Map a mode to (locale, opts) for Intl.NumberFormat. Returns null for
// `'system'` so the caller falls back to the browser default.
export function intlConfigForNumberFormat(
  format: NumberFormatMode
): { locale: string; opts: Intl.NumberFormatOptions } | null {
  switch (format) {
    case 'comma-dot':
      return { locale: 'en-US', opts: {} };
    case 'dot-comma':
      return { locale: 'de-DE', opts: {} };
    case 'space-comma':
      return { locale: 'fr-FR', opts: {} };
    case 'indian':
      // en-IN naturally groups by lakh/crore (3 digits then groups of
      // 2): 12,34,567.89. Decimal stays '.'.
      return { locale: 'en-IN', opts: {} };
    case 'plain':
      // Suppress thousands grouping; decimal stays `.` to match the
      // unambiguous ISO-ish render.
      return { locale: 'en-US', opts: { useGrouping: false } };
    case 'system':
    default:
      return null;
  }
}
