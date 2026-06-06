import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { bankAccountKeys } from './keys';
import type { BankAccount } from './schemas';

export function fetchBankAccounts(): Promise<BankAccount[]> {
  return apiFetch<BankAccount[]>(routes.bankAccounts.root());
}

// 60s stale: the list itself rarely changes mid-session, and
// mutations invalidate `bankAccountKeys.all` explicitly so a write
// surfaces immediately. Same posture as the other settings-shape
// feature queries (tags, taxation rules).
export function useBankAccountsQuery(enabled = true) {
  return useQuery({
    queryKey: bankAccountKeys.list(),
    queryFn: fetchBankAccounts,
    enabled,
    staleTime: 60_000,
  });
}
