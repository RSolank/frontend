import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Taxation mode (T-treasury) — 3-state, replacing the old boolean
// `auto_enabled`:
//   • `auto`   — the Monday weekly worker finalizes ACCRUING → BILLED
//                bills on schedule.
//   • `manual` — bills accrue for visibility but never auto-finalize;
//                the user drives generation via
//                `POST /consumption-tax/bills/generate`.
//   • `off`    — expense-tracker only: the taxation engine is fully
//                disabled (no accrual, no bills).
//
// Stacking defense: when the unpaid-bill count crosses
// `STALE_BILL_THRESHOLD` (BE constant, default 4), the worker expires
// the unpaid bills AND flips this from `auto` → `manual` — surfaced as
// an `activity_feed` event (`tax_mode_auto_disabled`).
//
// Server-synced via `/api/users/preferences.tax_mode`. Hydrated at boot
// by `hydratePreferences()` and PATCHed back on user-driven `setMode`
// by `subscribeToPreferenceStores()` (features/users/api/preferences.ts).
// Zustand `persist` (`localStorage["tax-mode"]`) bridges cold-boot to
// the GET response.
//
// Lives in `shared/state/` (not `features/taxation/state/`) because the
// account-preferences page consumes the selector across the feature
// boundary — same pattern as the other 6 preference stores.

export type TaxMode = 'off' | 'manual' | 'auto';

interface TaxModeState {
  mode: TaxMode;
  setMode: (next: TaxMode) => void;
}

export const useTaxModeStore = create<TaxModeState>()(
  persist(
    (set) => ({
      // Default `auto` — matches the BE column server_default + the most
      // common intent (let the worker drive). The hydrate path overwrites
      // it with the BE value once the row arrives.
      mode: 'auto',
      setMode: (next) => set({ mode: next }),
    }),
    { name: 'tax-mode' }
  )
);
