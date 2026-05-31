import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Workflow preference — picks the initial value of the debit/credit
// field on the Add Transaction form. Users who track expenses
// overwhelmingly default to 'debit'; users tracking income / both
// flows may prefer to start on 'credit'. Read once on form mount via
// `getState()` (not subscribed) so editing this preference doesn't
// retroactively flip an open form.
//
// Server-synced after BE Phase 1.9 — the `user_preferences` row's
// `default_txn_kind` column is the SoT. Hydrated at boot by
// `hydratePreferences()` and PATCHed back on user-driven setX by
// `subscribeToPreferenceStores()` (see CONTRIBUTING.md §5).
// Zustand `persist` (`localStorage["default-txn-kind"]`) is the
// local cache that bridges between cold-boot and the GET response.

export type DefaultTxnKind = 'debit' | 'credit';

interface DefaultTxnKindState {
  kind: DefaultTxnKind;
  setKind: (kind: DefaultTxnKind) => void;
}

export const useDefaultTxnKindStore = create<DefaultTxnKindState>()(
  persist(
    (set) => ({
      kind: 'debit',
      setKind: (kind) => set({ kind }),
    }),
    { name: 'default-txn-kind' }
  )
);

// Imperative read for use outside React render (e.g. the Add
// Transaction form's initial useState).
export function getDefaultTxnKind(): DefaultTxnKind {
  return useDefaultTxnKindStore.getState().kind;
}
