import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility / personalization — picks the thousands + decimal
// separator pair used by every user-facing amount rendered through
// `formatMoney` in `shared/utils/currency.ts`.
//
// Frontend-only (Zustand `persist` ⇒ `localStorage["number-format"]`)
// by design. Does NOT follow the user across devices. Backend has no
// `number_format` column today; when it lands, the same hydration
// shape used for currency/timezone applies. Until then this is
// on-device only.

export type NumberFormatMode =
  | 'system' // Browser locale default, no override.
  | 'comma-dot' // 1,234.56 — en-US / en-GB style.
  | 'dot-comma' // 1.234,56 — de-DE / es / it style.
  | 'space-comma' // 1 234,56 — fr-FR / sv style.
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
    case 'plain':
      // Suppress thousands grouping; decimal stays `.` to match the
      // unambiguous ISO-ish render.
      return { locale: 'en-US', opts: { useGrouping: false } };
    case 'system':
    default:
      return null;
  }
}
