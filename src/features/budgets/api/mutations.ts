import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { BudgetLimit } from './queries';
import type { BudgetFormInput } from './schemas';

// POST /api/budget-limits/ — backend upsert by (user, tag_id, period).
// Returns the persisted row with the tag_name joined back in.
export function upsertBudgetLimitRequest(
  payload: BudgetFormInput
): Promise<{ budget: BudgetLimit }> {
  return apiFetch<{ budget: BudgetLimit }>(routes.budgets.root(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// DELETE /api/budget-limits/{tag_id}?budget_period=monthly — shipped
// BE Phase 1.3 (`a89ebfc`). 204 on success, 404 if no row, 400 on
// unknown tag id. See `task-platform.md → budgets.delete-endpoint`.
export function deleteBudgetLimitRequest(
  tag_id: number,
  budget_period = 'monthly'
): Promise<void> {
  return apiFetch(
    `${routes.budgets.byTag(tag_id)}?budget_period=${encodeURIComponent(budget_period)}`,
    { method: 'DELETE' }
  );
}
