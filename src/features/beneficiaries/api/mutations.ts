import { apiFetch } from '../../../shared/api/apiClient';

import type { Beneficiary } from './queries';
import type { BeneficiaryPayload, MergePayload } from './schemas';

export function createBeneficiaryRequest(
  payload: BeneficiaryPayload
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>('/api/beneficiaries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBeneficiaryRequest(
  uid: number | string,
  payload: BeneficiaryPayload
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(`/api/beneficiaries/${uid}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteBeneficiaryRequest(
  uid: number | string
): Promise<unknown> {
  return apiFetch<unknown>(`/api/beneficiaries/${uid}`, { method: 'DELETE' });
}

export function mergeBeneficiariesRequest(
  payload: MergePayload
): Promise<unknown> {
  return apiFetch<unknown>('/api/beneficiaries/merge', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Categorization-rule helpers needed by BeneficiaryFormFields' rule-tag
// editor. Owned here so the form doesn't reach across feature
// boundaries; the dedicated categorization feature in Batch 6 will own
// the surface that *manages* rules, but creating/updating rules in
// response to a beneficiary change stays on the beneficiary form.
export function updateCategorizationRuleTags(
  ruleUid: number,
  tagIds: number[]
): Promise<unknown> {
  return apiFetch<unknown>(`/api/categorization-rules/${ruleUid}`, {
    method: 'PUT',
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

export function deleteCategorizationRule(ruleUid: number): Promise<unknown> {
  return apiFetch<unknown>(`/api/categorization-rules/${ruleUid}`, {
    method: 'DELETE',
  });
}
