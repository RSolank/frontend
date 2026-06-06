// Dashboard schemas — activity types were relocated to
// `shared/api/activityFeed.ts` + `shared/api/activityCatalog.ts` when
// the TopNav bell took over the activity surface (Batch 18). This file
// keeps the per-card schemas dashboard owns directly.

// BE Phase 1.7 (`3252ca4`) — Expense trend rows. Per-(tag, bucket)
// stats over the last `n` buckets of the requested `period_type`.
// Stored grains (weekly / monthly) carry per-bucket anomaly stats;
// derived grains (quarterly / annual) leave them null.
export type TrendPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface ExpenseTrendRow {
  tag_id: number;
  tag_name: string | null;
  period_type: TrendPeriod;
  period_start: string;
  period_end: string;
  total_count: number;
  total_debit: number;
  total_credit: number;
  net_expense: number;
  avg_net_expense: number | null;
  min_net_expense: number | null;
  max_net_expense: number | null;
}

export interface ExpenseTrendResponse {
  period_type: TrendPeriod;
  returned_count: number;
  rows: ExpenseTrendRow[];
}
