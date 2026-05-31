import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { budgetKeys } from './keys';

// One row of `/api/budget-limits/status.categories[]` (and the same
// shape for `.total_budget`). All numeric fields are nullable because
// a tag with no spend in the requested month carries 0/null aggregates
// + a null limit_amt (no budget configured).
//
// BE Phase 1.7 (`3252ca4`, T-aggregates-engine) renamed the spend fields
// to the **net-expense** family: `net_expense = total_debit − total_credit`
// (expense-positive — refunds net spend down). `current_debit` and
// `current_credit` ship alongside for surfaces that need the gross
// breakdown; budget breaches + anomaly stats compare against
// `current_net_expense`.
export interface BudgetCategory {
  tag_id: number;
  tag_name: string;
  tag_type: string;
  current_debit: number | null;
  current_credit: number | null;
  current_net_expense: number | null;
  avg_net_expense: number | null;
  min_net_expense: number | null;
  max_net_expense: number | null;
  limit_amt: number | null;
  penalty_rate: number | null;
  default_penalty_rate: number | null;
}

export interface BudgetStatusResponse {
  categories: BudgetCategory[];
  total_budget: BudgetCategory | null;
  currency: string;
  month: string;
  available_months: string[];
}

export function fetchBudgetStatus(
  month: string | null
): Promise<BudgetStatusResponse> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  return apiFetch<BudgetStatusResponse>(`${routes.budgets.status()}${qs}`);
}

export function useBudgetStatusQuery(month: string | null) {
  return useQuery({
    queryKey: budgetKeys.status(month),
    queryFn: () => fetchBudgetStatus(month),
  });
}

// Lightweight list of configured budget limits (no spend aggregates).
// Currently unused by ExpenseTrackerPage (which prefers the merged
// /status payload) but exported so the future Dashboard card in
// Batch 8.5 can pull just the limits without paying for the full
// expense aggregation.
export interface BudgetLimit {
  uid: number;
  tag_id: number;
  tag_name: string | null;
  budget_period: string;
  limit_amt: number;
  penalty_rate: number;
  created_by: number | null;
  created_at: string;
}

export function fetchBudgetLimits(
  budget_period = 'monthly'
): Promise<{ budgets: BudgetLimit[] }> {
  return apiFetch<{ budgets: BudgetLimit[] }>(
    `${routes.budgets.root()}?budget_period=${encodeURIComponent(budget_period)}`
  );
}

export function useBudgetLimitsQuery(budget_period = 'monthly') {
  return useQuery({
    queryKey: budgetKeys.list(budget_period),
    queryFn: () => fetchBudgetLimits(budget_period),
  });
}
