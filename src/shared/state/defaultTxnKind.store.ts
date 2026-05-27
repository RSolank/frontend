import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Workflow preference — picks the initial value of the debit/credit
// field on the Add Transaction form. Users who track expenses
// overwhelmingly default to 'debit'; users tracking income / both
// flows may prefer to start on 'credit'. Read once on form mount via
// `getState()` (not subscribed) so editing this preference doesn't
// retroactively flip an open form.
//
// Frontend-only (Zustand `persist` ⇒ `localStorage["default-txn-kind"]`)
// by design — joins the other page-only stores (`useLandingRouteStore`,
// `useDateFormatStore`, etc.). Backend persistence ask filed in
// `.scratch/task-handoff-fe-to-be.md §7` ("Defaults cluster
// persistence"); when the column lands, hydrate alongside currency /
// timezone via the same boot flow.

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
