// React-query keys for the bank-accounts feature (BE Phase 1.1,
// `1bc5454`). Mutations invalidate `bankAccountKeys.all` so the
// list page, the AddTransaction picker, and the settings nudge
// all refresh in lockstep.
export const bankAccountKeys = {
  all: ['bankAccounts'] as const,
  list: () => [...bankAccountKeys.all, 'list'] as const,
  detail: (uid: number) => [...bankAccountKeys.all, 'detail', uid] as const,
} as const;
