import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { treasuryKeys } from './keys';

// One bucket of `/treasury/summary.trend[]` — a single ISO week (Mon→Sun).
// `cumulative_balance` is the running funded balance *through* that week
// (carrying the pre-window balance forward); `delta` is the net change
// booked in the week alone. The Savings trend plots `cumulative_balance`.
export interface TreasuryTrendPoint {
  period_end: string;
  cumulative_balance: number;
  delta: number;
}

// `GET /treasury/summary` — the set-aside view (BE T-treasury). Derived,
// reconcile-on-read, over the append-only committee revenue journal:
//
// - `funded_balance`      — Σ income + Σ deferred_revenue (total cash set aside)
// - `recognized_revenue`  — Σ income (matched to a levied bill) → "Gained from self-tax"
// - `deferred_balance`    — Σ deferred_revenue (surplus the user added on top) → "Surplus you added"
// - `provisioned_total`   — Σ levied bill amount (owed to your future self)
// - `currency`            — the user's currency code (echoed for non-prefs surfaces)
// - `trend`               — weekly cumulative funded balance, oldest → newest
export interface TreasurySummary {
  funded_balance: number;
  recognized_revenue: number;
  deferred_balance: number;
  provisioned_total: number;
  currency: string;
  trend: TreasuryTrendPoint[];
}

export function fetchTreasurySummary(weeks: number): Promise<TreasurySummary> {
  return apiFetch<TreasurySummary>(
    `${routes.treasury.summary()}?weeks=${encodeURIComponent(weeks)}`
  );
}

// Default 12-week window matches the BE default + the Savings trend chart.
export function useTreasurySummaryQuery(weeks = 12) {
  return useQuery({
    queryKey: treasuryKeys.summary(weeks),
    queryFn: () => fetchTreasurySummary(weeks),
  });
}
