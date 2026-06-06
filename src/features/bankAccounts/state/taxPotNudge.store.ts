import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Tax-pot nudge dismiss state. A user who's dismissed the nudge
// once doesn't see it again — even if their accounts state
// changes — until they explicitly opt back in. Persisted under
// `pba.tax-pot-nudge` so the dismiss survives reloads.
//
// Decision (Batch 13): one shared dismiss flag covers both
// surfaces the nudge appears on (the Bank Accounts page banner +
// the settings root one-liner). The user dismisses once, both
// surfaces hide.
interface State {
  dismissed: boolean;
  dismiss: () => void;
  reset: () => void;
}

export const useTaxPotNudgeStore = create<State>()(
  persist(
    (set) => ({
      dismissed: false,
      dismiss: () => set({ dismissed: true }),
      reset: () => set({ dismissed: false }),
    }),
    { name: 'pba.tax-pot-nudge' }
  )
);
