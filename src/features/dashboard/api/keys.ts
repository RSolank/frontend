// React-query keys for the dashboard feature.
//
// `useActivityFeedQuery` keys the BE Phase 2.4 `GET /api/activity` feed.
// `useExpenseTrendQuery` keys the BE Phase 1.7 `GET /api/expense-tracker`
// per-(tag, bucket) trend the dashboard + budgets pages render.
export const dashboardKeys = {
  all: ['dashboard'] as const,
  activity: (limit: number) =>
    [...dashboardKeys.all, 'activity', limit] as const,
  trend: (period_type: string, n: number, tag_id?: number) =>
    [...dashboardKeys.all, 'trend', period_type, n, tag_id ?? null] as const,
} as const;
