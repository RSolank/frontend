import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type {
  RecurringTemplate,
  RecurringTemplateCreatePayload,
  RecurringTemplateUpdatePayload,
} from './schemas';

// POST /api/recurring/templates — declare a template by hand. Returns
// the canonical row, which the caller passes through React Query's
// `setQueryData` or invalidation to refresh the list.
export function createRecurringTemplateRequest(
  payload: RecurringTemplateCreatePayload
): Promise<RecurringTemplate> {
  return apiFetch<RecurringTemplate>(routes.recurring.templates(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// PATCH /api/recurring/templates/{uid} — partial update. Touching ANY
// field transfers `created_by` to the user; `status: 'locked'` is the
// user-facing Confirm action, `active: false` is the soft-dismiss.
export function updateRecurringTemplateRequest(
  uid: number,
  payload: RecurringTemplateUpdatePayload
): Promise<RecurringTemplate> {
  return apiFetch<RecurringTemplate>(routes.recurring.templateById(uid), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// DELETE /api/recurring/templates/{uid} — soft-deactivate. Bills
// cascade per BE Phase 1.5 docs; the row stays in the DB so the user
// can re-activate via PATCH `active: true` later if needed.
export function deleteRecurringTemplateRequest(uid: number): Promise<void> {
  return apiFetch<void>(routes.recurring.templateById(uid), {
    method: 'DELETE',
  });
}
