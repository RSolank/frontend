// React-query keys for the dashboard feature.
//
// The activity-feed key moved to `shared/api/activityKeys.ts` when
// the TopNav bell took over the activity surface (Batch 18).
// `useExpenseTrendQuery` keys the BE Phase 1.7 `GET /api/expense-tracker`
// per-(tag, bucket) trend the dashboard + budgets pages render.
export const dashboardKeys = {
  all: ['dashboard'] as const,
  // `end` anchors the window's last bucket (defaults to "now" when omitted),
  // so the expense-tracker page's month selector keys distinct trend windows.
  trend: (period_type: string, n: number, tag_id?: number, end?: string) =>
    [
      ...dashboardKeys.all,
      'trend',
      period_type,
      n,
      tag_id ?? null,
      end ?? null,
    ] as const,
} as const;
