import { apiFetch } from '../../../shared/api/apiClient';

import type { BudgetLimit } from './queries';
import type { BudgetFormInput } from './schemas';

// POST /api/budget-limits/ — backend upsert by (user, tag_id, period).
// Returns the persisted row with the tag_name joined back in.
export function upsertBudgetLimitRequest(
  payload: BudgetFormInput
): Promise<{ budget: BudgetLimit }> {
  return apiFetch<{ budget: BudgetLimit }>('/api/budget-limits/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Sentinel error tag used by `<BudgetFormDialog />` to detect the
// "backend endpoint not implemented yet" case and surface a clearer
// message than the apiClient's generic "Request failed" string.
export const BUDGET_DELETE_NOT_IMPLEMENTED = 'BUDGET_DELETE_NOT_IMPLEMENTED';

// DELETE /api/budget-limits/{tag_id}?budget_period=monthly — proposed
// endpoint, not yet implemented on the backend. Contract spec at
// `.scratch/task-handoff-fe-to-be.md §3`. The
// frontend wires the call now so the surface is complete and the
// only follow-up is a backend ship; we catch HTTP 404 / 405 / 501
// and rethrow a typed sentinel so the modal can render the right
// "coming soon" message instead of an opaque error.
export async function deleteBudgetLimitRequest(
  tag_id: number,
  budget_period = 'monthly'
): Promise<void> {
  try {
    await apiFetch(
      `/api/budget-limits/${tag_id}?budget_period=${encodeURIComponent(budget_period)}`,
      { method: 'DELETE' }
    );
  } catch (err) {
    const e = err as { status?: number };
    if (e?.status === 404 || e?.status === 405 || e?.status === 501) {
      const wrapped = new Error(BUDGET_DELETE_NOT_IMPLEMENTED);
      (wrapped as Error & { code?: string }).code =
        BUDGET_DELETE_NOT_IMPLEMENTED;
      throw wrapped;
    }
    throw err;
  }
}
