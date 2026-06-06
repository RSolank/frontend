import { useQuery } from '@tanstack/react-query';

import { apiFetch, type ApiError } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';
import type { UserStatsResponse } from '../../users/api/queries';

import { adminKeys } from './keys';

// BE T-admin A3 (`4b6004e`) — single-user detail composed from the
// owner modules' admin reads. Types are hand-rolled (mirroring the
// Pydantic shape) for the same reason every other admin type is —
// `shared/types/api.ts` is doc-infra, not the consumer SoT.

export interface AdminSessionRow {
  session_id: string;
  ip_address: string;
  device_summary: string;
  is_locked: boolean;
  created_at: string;
  expires_at: string;
}

export interface AdminDeviceRow {
  device_uid: number;
  fingerprint: string;
  label: string | null;
  last_seen_at: string;
}

export interface AdminCemeteryStatus {
  deleted_at: string;
  scheduled_purge_at: string;
}

// Activity event mirrors `features/dashboard/api/schemas.ts → ActivityEvent`
// (BE T-activity-feed reuses the same DTO). Re-declared locally to keep
// admin's import graph independent of dashboard.
export interface AdminActivityEvent {
  event_id: string;
  kind: string;
  priority: number;
  value: number;
  at: string;
  summary: string;
  subject_type: string;
  subject_id: string;
  state: string;
  source: string;
  meta: Record<string, unknown>;
}

export interface AdminUserDetail {
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  registered_at: string;
  last_active_at: string | null;
  locked_until: string | null;
  deleted_at: string | null;
  // BE T-admin B1 + backfill (`2bb48c6`) — admin recovery-proof
  // disable timestamp. null = active, non-null = disabled-since.
  disabled_at: string | null;
  two_factor_enabled: boolean;
  session_count: number;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  recent_sessions: AdminSessionRow[];
  recent_known_devices: AdminDeviceRow[];
  // `null` until BE wires the per-user activity-feed query; the page
  // hides the section in that state.
  recent_activity: AdminActivityEvent[] | null;
  cemetery_status: AdminCemeteryStatus | null;
  // Reuses the /me/stats response shape verbatim.
  stats: UserStatsResponse;
}

export function fetchAdminUserDetail(userId: number): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(routes.admin.userDetail(userId));
}

// `enabled` gates the fetch on the caller having admin role (the
// second-line check in the page itself); a non-admin landing on
// `/admin/users/:id` sees the gate panel and never burns a 403.
export function useAdminUserDetailQuery(userId: number, enabled: boolean) {
  return useQuery<AdminUserDetail, ApiError>({
    queryKey: adminKeys.userDetail(userId),
    queryFn: () => fetchAdminUserDetail(userId),
    enabled,
    // Detail is read-only in A3; lock/force-logout (B1/B2) invalidate
    // this key on success so the page reflects the mutation.
    staleTime: 30_000,
  });
}
