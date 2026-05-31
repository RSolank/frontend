import { useQuery } from '@tanstack/react-query';

import { apiFetch, type ApiError } from './apiClient';
import { routes } from './routes';

// Admin-portal access gate. BE Phase 1.11 (`b8db9b5`) ships
// `GET /api/admin/ping` returning 200 when the caller has the ADMIN
// role and 403 otherwise. `role` isn't yet exposed on `/me`, so the
// FE gates on a successful ping; when the BE adds the field we'll
// switch the gate to read from there in a one-line edit.
//
// Lives in `shared/` because the TopNav user dropdown — a
// cross-feature surface — needs to read it, and the dependency rule
// blocks `shared/` from importing `features/`. The query itself is
// boolean-resolved (never throws) so consumers can use it as a flag.

interface PingResponse {
  status?: string;
  user_id?: number;
}

export async function checkAdminGate(): Promise<boolean> {
  try {
    await apiFetch<PingResponse>(routes.admin.ping());
    return true;
  } catch (err) {
    const e = err as ApiError;
    // 403 / 401 / network all map to "not admin"; failing closed is
    // the right default for a privilege probe.
    return e.status === 200;
  }
}

const adminGateKeys = {
  all: ['admin'] as const,
  gate: () => [...adminGateKeys.all, 'gate'] as const,
} as const;

// `enabled` is `false` for unauthenticated visitors so we don't burn
// a request that would 401. The caller flips it on once
// `useAuthStore.user` is populated.
export function useAdminGateQuery(enabled = true) {
  return useQuery({
    queryKey: adminGateKeys.gate(),
    queryFn: checkAdminGate,
    enabled,
    // Role rarely changes; cache aggressively. Login/logout cycles
    // remount the tree and re-fire the query naturally.
    staleTime: 30 * 60 * 1000,
  });
}
