import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';

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
  return apiFetch<Beneficiary[]>('/api/beneficiaries');
}

export function fetchBeneficiary(id: number | string): Promise<Beneficiary> {
  return apiFetch<Beneficiary>(`/api/beneficiaries/${id}`);
}

export function fetchRelationships(): Promise<string[]> {
  return apiFetch<string[]>('/api/beneficiaries/relationships');
}

export function fetchCategorizationRules(): Promise<CategorizationRulesResponse> {
  return apiFetch<CategorizationRulesResponse>('/api/categorization-rules');
}

export function useBeneficiariesQuery() {
  return useQuery({
    queryKey: beneficiaryKeys.list(),
    queryFn: fetchBeneficiaries,
  });
}
