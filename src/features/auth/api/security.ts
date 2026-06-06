import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { authKeys } from './keys';

// BE `auth.security-status` — `GET /api/v1/auth/security` ships the
// auth-owned account-protection snapshot: 2FA flag, remaining backup
// codes, and whether recovery is configured. Lives on the auth route
// (not `/me`) so `UserAuth`-owned security state never rides the
// users-module profile DTO — keeps the profile/auth domain split
// clean across the FE/BE boundary.
export interface SecurityStatus {
  has_recovery: boolean;
  two_factor_enabled: boolean;
  backup_codes_remaining: number;
}

export function fetchSecurityStatus(): Promise<SecurityStatus> {
  return apiFetch<SecurityStatus>(routes.auth.security());
}

export function useSecurityStatusQuery(enabled = true) {
  return useQuery({
    queryKey: authKeys.security(),
    queryFn: fetchSecurityStatus,
    enabled,
    // The BE `refresh_account_security` event-bus signal invalidates
    // this snapshot on every security mutation; in the meantime a
    // short stale window is fine — the page is informational and the
    // user is unlikely to flip 2FA twice in 30s.
    staleTime: 30_000,
  });
}
