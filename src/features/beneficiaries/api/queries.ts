import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { beneficiaryKeys } from './keys';

export type BeneficiaryType = 'merchant' | 'person';

export interface MerchantDetail {
  category?: string | null;
  contact?: string | null;
  upi_id?: string | null;
}

export interface PersonDetail {
  relationship_type?: string | null;
  phone?: string | null;
  upi_id?: string | null;
}

export interface Beneficiary {
  uid: number;
  name: string;
  aliases: string[];
  beneficiary_type: BeneficiaryType;
  merchant?: MerchantDetail | null;
  person?: PersonDetail | null;
  // True for system-created rows (created_by == SYSTEM) — drives the "System"
  // chip so the user can tell shipped rows from ones they added.
  is_system?: boolean;
}

export interface AliasUniqueResponse {
  alias: string;
  unique: boolean;
}

export interface CategorizationRule {
  uid: number;
  beneficiary_id: number;
  tag_ids: number[];
}

interface CategorizationRulesResponse {
  rules: CategorizationRule[];
}

export function fetchBeneficiaries(): Promise<Beneficiary[]> {
  return apiFetch<Beneficiary[]>(routes.beneficiaries.list());
}

export function fetchBeneficiary(id: number | string): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(routes.beneficiaries.byId(id));
}

export function fetchRelationships(): Promise<string[]> {
  return apiFetch<string[]>(routes.beneficiaries.relationships());
}

export function fetchCategorizationRules(): Promise<CategorizationRulesResponse> {
  return apiFetch<CategorizationRulesResponse>(
    routes.categorizationRules.list()
  );
}

export function useBeneficiariesQuery() {
  return useQuery({
    queryKey: beneficiaryKeys.list(),
    queryFn: fetchBeneficiaries,
  });
}
