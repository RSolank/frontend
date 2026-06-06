import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { adminKeys } from './keys';

// BE T-admin B1 (`a13669e`) — recovery-proof admin disable via
// `UserAuth.disabled_at`. Returns the new disable state; 404 for
// missing/SYSTEM, 409 if the account is already in the target state.
export interface AdminAccountStatusResponse {
  user_id: number;
  disabled_at: string | null;
}

export interface AdminForceLogoutResponse {
  terminated: number;
}

export function lockAdminUser(args: {
  userId: number;
  reason?: string;
}): Promise<AdminAccountStatusResponse> {
  const body: { reason?: string } = {};
  if (args.reason) body.reason = args.reason;
  return apiFetch<AdminAccountStatusResponse>(
    routes.admin.userLock(args.userId),
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }
  );
}

export function unlockAdminUser(
  userId: number
): Promise<AdminAccountStatusResponse> {
  return apiFetch<AdminAccountStatusResponse>(routes.admin.userUnlock(userId), {
    method: 'PATCH',
  });
}

export function forceLogoutAdminUser(
  userId: number
): Promise<AdminForceLogoutResponse> {
  return apiFetch<AdminForceLogoutResponse>(routes.admin.userSessions(userId), {
    method: 'DELETE',
  });
}

// Mutation hooks invalidate the detail + the list keys so the status
// chip flips on both surfaces without a manual refetch. Force-logout
// only invalidates the detail (sessions table reflects the lock).
export function useLockAdminUserMutation(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string | undefined) =>
      lockAdminUser({ userId, reason }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminKeys.userDetail(userId) }),
        qc.invalidateQueries({ queryKey: adminKeys.users() }),
      ]);
    },
  });
}

export function useUnlockAdminUserMutation(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unlockAdminUser(userId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminKeys.userDetail(userId) }),
        qc.invalidateQueries({ queryKey: adminKeys.users() }),
      ]);
    },
  });
}

export function useForceLogoutAdminUserMutation(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => forceLogoutAdminUser(userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.userDetail(userId) });
    },
  });
}
