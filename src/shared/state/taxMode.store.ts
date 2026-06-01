import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// BE Phase 2.6 (`e7c05aa`, Decision 26) — auto-mode toggle for the
// taxation engine. When ON, the Monday weekly worker finalizes
// ACCRUING → BILLED bills on schedule; when OFF, bills accumulate in
// ACCRUING for visibility but never auto-finalize and the user drives
// generation via `POST /consumption-tax/bills/generate`.
//
// Stacking defense: when the unpaid-bill count crosses
// `STALE_BILL_THRESHOLD` (BE constant, default 4), the worker
// expires the unpaid bills AND flips this toggle off — surfaced as
// an `activity_feed` event (`tax_mode_auto_disabled`) once that
// kind is wired.
//
// Server-synced via `/api/users/preferences.auto_enabled`. Hydrated
// at boot by `hydratePreferences()` and PATCHed back on user-driven
// setX by `subscribeToPreferenceStores()` (features/users/api/
// preferences.ts). Zustand `persist` (`localStorage["tax-mode"]`)
// is the local cache that bridges cold-boot to the GET response.
//
// Lives in `shared/state/` (not `features/taxation/state/`) because
// the account-preferences page consumes the toggle across the
// feature boundary — same pattern as the other 6 preference stores
// (LinkUnderline / FocusRing / DateFormat / etc.).

interface TaxModeState {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
}

export const useTaxModeStore = create<TaxModeState>()(
  persist(
    (set, get) => ({
      // Default ON — matches the BE column server_default + the most
      // common user intent (let the worker drive). The hydrate path
      // overwrites it with the BE value once the row arrives.
      enabled: true,
      setEnabled: (next) => set({ enabled: next }),
      toggle: () => set({ enabled: !get().enabled }),
    }),
    { name: 'tax-mode' }
  )
);
