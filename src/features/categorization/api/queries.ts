import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';

import { categorizationKeys } from './keys';

// Server-shape of a categorization rule as returned from
// /api/categorization-rules. `created_by` distinguishes system seeds
// (== SYSTEM_USER_ID from /api/metadata/constants) from user rules.
export interface CategorizationRule {
  uid: number;
  rule_name: string;
  beneficiary_id: number;
  beneficiary_name: string;
  beneficiary_aliases: string[];
  tag_ids: number[];
  notes: string | null;
  created_by: number | null;
}

export interface CategorizationRulesResponse {
  rules: CategorizationRule[];
}

export function fetchCategorizationRules(): Promise<CategorizationRulesResponse> {
  return apiFetch<CategorizationRulesResponse>('/api/categorization-rules');
}

export function useCategorizationRulesQuery() {
  return useQuery({
    queryKey: categorizationKeys.rulesList(),
    queryFn: fetchCategorizationRules,
  });
}
