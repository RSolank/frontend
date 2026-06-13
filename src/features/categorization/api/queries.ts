import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { categorizationKeys } from './keys';

// Server-shape of a categorization rule as returned from
// /api/categorization-rules. `created_by` distinguishes system seeds
// (== SYSTEM_USER_ID from /api/metadata/constants) from user rules;
// `is_system` is the server's pre-computed equivalent that drives the
// "System" chip without the FE needing the SYSTEM_USER_ID constant.
export interface CategorizationRule {
  uid: number;
  rule_name: string;
  beneficiary_id: number;
  beneficiary_name: string;
  beneficiary_aliases: string[];
  tag_ids: number[];
  notes: string | null;
  created_by: number | null;
  is_system?: boolean;
}

export interface CategorizationRulesResponse {
  rules: CategorizationRule[];
}

export function fetchCategorizationRules(): Promise<CategorizationRulesResponse> {
  return apiFetch<CategorizationRulesResponse>(
    routes.categorizationRules.list()
  );
}

export function useCategorizationRulesQuery() {
  return useQuery({
    queryKey: categorizationKeys.rulesList(),
    queryFn: fetchCategorizationRules,
  });
}
