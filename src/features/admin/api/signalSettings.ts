import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CatalogEntry } from '../../../shared/api/activityCatalog';
import { activityKeys } from '../../../shared/api/activityKeys';
import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

// BE T-admin E1 (Phase 2.16) — operator layer over per-user signal-
// settings + system catalog tunables.
//   GET  /api/v1/admin/users/{id}/signal-settings → {disabled[]}
//   PUT  /api/v1/admin/users/{id}/signal-settings {kind, enabled}
//   PUT  /api/v1/admin/signal-catalog/{kind} {priority?, rank_order?,
//        system_enabled?} → CatalogEntryOut

export interface AdminUserSignalSettings {
  disabled: string[];
}

export interface AdminUserSignalUpdate {
  kind: string;
  enabled: boolean;
}

export interface AdminCatalogTunePatch {
  priority?: number;
  rank_order?: number;
  system_enabled?: boolean;
}

export function fetchAdminUserSignalSettings(
  userId: number
): Promise<AdminUserSignalSettings> {
  return apiFetch<AdminUserSignalSettings>(
    routes.admin.userSignalSettings(userId)
  );
}

export function updateAdminUserSignalSetting(args: {
  userId: number;
  body: AdminUserSignalUpdate;
}): Promise<AdminUserSignalSettings> {
  return apiFetch<AdminUserSignalSettings>(
    routes.admin.userSignalSettings(args.userId),
    {
      method: 'PUT',
      body: JSON.stringify(args.body),
      headers: { 'content-type': 'application/json' },
    }
  );
}

export function tuneAdminSignalCatalog(args: {
  kind: string;
  patch: AdminCatalogTunePatch;
}): Promise<CatalogEntry> {
  return apiFetch<CatalogEntry>(routes.admin.signalCatalogKind(args.kind), {
    method: 'PUT',
    body: JSON.stringify(args.patch),
    headers: { 'content-type': 'application/json' },
  });
}

export function useAdminUserSignalSettingsQuery(
  userId: number,
  enabled: boolean
) {
  return useQuery({
    queryKey: activityKeys.adminUserSignalSettings(userId),
    queryFn: () => fetchAdminUserSignalSettings(userId),
    enabled,
    staleTime: 30_000,
  });
}

// Optimistic invalidation: the PUT returns the new disabled list,
// so we drop the new payload directly into the cache (no refetch
// needed) and also invalidate the catalog (in case the BE later
// surfaces per-user-effective state there).
export function useUpdateAdminUserSignalMutation(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminUserSignalUpdate) =>
      updateAdminUserSignalSetting({ userId, body }),
    onSuccess: (next) => {
      qc.setQueryData(activityKeys.adminUserSignalSettings(userId), next);
    },
  });
}

// Tuning the catalog system-wide affects every user's feed — invalidate
// the catalog query so any open editor / bell re-fetches.
export function useTuneAdminSignalCatalogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tuneAdminSignalCatalog,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activityKeys.catalog() });
    },
  });
}
