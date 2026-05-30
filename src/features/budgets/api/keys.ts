// React-query keys for the budgets feature. `status` carries the per-
// month detailed report; `list` carries the lightweight budget-limit
// list. Mutations invalidate `budgetKeys.all` so every subtree
// refreshes after an upsert.
export const budgetKeys = {
  all: ['budgets'] as const,
  status: (month: string | null) =>
    [...budgetKeys.all, 'status', month ?? 'current'] as const,
  list: (period: string) =>
    [...budgetKeys.all, 'list', period] as const,
} as const;
