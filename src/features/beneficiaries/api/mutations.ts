import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { Beneficiary } from './queries';
import type { BeneficiaryPayload, MergePayload } from './schemas';

export function createBeneficiaryRequest(
  payload: BeneficiaryPayload
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(routes.beneficiaries.create(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBeneficiaryRequest(
  uid: number | string,
  payload: BeneficiaryPayload
): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(routes.beneficiaries.byId(uid), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteBeneficiaryRequest(
  uid: number | string
): Promise<unknown> {
  return apiFetch<unknown>(routes.beneficiaries.byId(uid), { method: 'DELETE' });
}

export function mergeBeneficiariesRequest(
  payload: MergePayload
): Promise<unknown> {
  return apiFetch<unknown>(routes.beneficiaries.merge(), {
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
  return apiFetch<unknown>(routes.categorizationRules.byId(ruleUid), {
    method: 'PUT',
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

export function deleteCategorizationRule(ruleUid: number): Promise<unknown> {
  return apiFetch<unknown>(routes.categorizationRules.byId(ruleUid), {
    method: 'DELETE',
  });
}

// POST helper used by the Add / Edit transaction flows in
// features/transactions/: when the user assigns tags to a transaction
// that has a beneficiary, we offer to crystallise that pair as a
// reusable categorization rule. Same ownership rationale as the
// update/delete helpers above (Batch 4 note 2).
export interface CreateCategorizationRulePayload {
  name: string;
  beneficiary_id: number | string;
  tag_ids: number[];
}

export interface CreateCategorizationRuleResponse {
  rule: { uid: number };
}

export function createCategorizationRule(
  payload: CreateCategorizationRulePayload
): Promise<CreateCategorizationRuleResponse> {
  return apiFetch<CreateCategorizationRuleResponse>(
    routes.categorizationRules.create(),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}
