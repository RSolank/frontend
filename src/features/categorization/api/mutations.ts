import { apiFetch } from '../../../shared/api/apiClient';

import type { CategorizationRulePayload } from './schemas';

// Update a rule with the full payload (name + beneficiary + tags +
// notes). The partial PUT (just tag_ids) used by the beneficiary
// form lives in features/beneficiaries/api/mutations.ts as
// `updateCategorizationRuleTags`; this page imports both depending on
// the edit surface (form vs. inline chip).
export function updateCategorizationRuleRequest(
  uid: number,
  payload: CategorizationRulePayload
): Promise<unknown> {
  return apiFetch<unknown>(`/api/categorization-rules/${uid}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Re-run the categorization engine against the existing transactions.
// Backend accepts an empty body and tags every uncategorized debit it
// can match.
export function reRunCategorizationRequest(): Promise<unknown> {
  return apiFetch<unknown>('/api/categorization-rules/re-run', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
