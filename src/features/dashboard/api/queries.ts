import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { dashboardKeys } from './keys';
import type { ExpenseTrendResponse, TrendPeriod } from './schemas';

// BE Phase 1.7 — `GET /api/expense-tracker?period_type=…&n=…&tag_id=…`.
// Per-(tag, bucket) spend trend over the last `n` buckets. Stored grains
// (weekly / monthly) carry per-bucket avg/min/max net-expense stats;
// derived grains (quarterly / annual) leave them null.
export function fetchExpenseTrend(
  period_type: TrendPeriod,
  n: number,
  tag_id?: number
): Promise<ExpenseTrendResponse> {
  const sp = new URLSearchParams({
    period_type,
    n: String(n),
  });
  if (tag_id !== undefined) sp.set('tag_id', String(tag_id));
  return apiFetch<ExpenseTrendResponse>(
    `${routes.expenseTracker.trend()}?${sp.toString()}`
  );
}

export function useExpenseTrendQuery(
  period_type: TrendPeriod,
  n: number,
  tag_id?: number,
  enabled = true
) {
  return useQuery({
    queryKey: dashboardKeys.trend(period_type, n, tag_id),
    queryFn: () => fetchExpenseTrend(period_type, n, tag_id),
    enabled,
    // Trend data is materialized read-model output; a 60s staleTime
    // matches the BE tracker cache and avoids hammering the read path
    // on dashboard mounts.
    staleTime: 60_000,
  });
}
