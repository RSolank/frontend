// React-query keys for the dashboard feature.
//
// The activity-feed key moved to `shared/api/activityKeys.ts` when
// the TopNav bell took over the activity surface (Batch 18).
// `useExpenseTrendQuery` keys the BE Phase 1.7 `GET /api/expense-tracker`
// per-(tag, bucket) trend the dashboard + budgets pages render.
export const dashboardKeys = {
  all: ['dashboard'] as const,
  trend: (period_type: string, n: number, tag_id?: number) =>
    [...dashboardKeys.all, 'trend', period_type, n, tag_id ?? null] as const,
} as const;
