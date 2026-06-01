import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Active statement-upload job tracked across page navigations
// (BE Phase 2.2). The /upload-statement page sets `activeJobId` on
// POST success; the global `<StatementUploadDock>` (mounted in the
// app shell) reads it and follows the poll until the job hits a
// terminal state. `persist` keeps the in-flight id across reloads
// — useful when a long parse spans a tab refresh.
//
// On the BE, non-terminal jobs are marked FAILED at restart (the
// background-task scheduler doesn't survive a worker reload); the
// dock surfaces that FAILED state via the standard poll, so the
// stale persisted id self-resolves rather than dangling.

export interface StatementUploadJobState {
  activeJobId: number | null;
  // The user-dismissable banner sticks around after a job hits
  // a terminal state so the user has a chance to read the result;
  // `dismissed: true` hides the dock for the active id without
  // clearing it (so a refresh doesn't bring it back).
  dismissed: boolean;
  setActiveJobId: (id: number | null) => void;
  dismiss: () => void;
  reset: () => void;
}

export const useStatementUploadJobStore = create<StatementUploadJobState>()(
  persist(
    (set) => ({
      activeJobId: null,
      dismissed: false,
      setActiveJobId: (id) => set({ activeJobId: id, dismissed: false }),
      dismiss: () => set({ dismissed: true }),
      reset: () => set({ activeJobId: null, dismissed: false }),
    }),
    { name: 'pba.statement-upload-job' }
  )
);
