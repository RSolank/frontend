import { useInfiniteQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { adminKeys, type AdminUsersListParams } from './keys';

// BE T-admin A2 (`2f21ff7`) — one row in the admin user inventory.
// Mirrors the server-side `AdminUserRow` Pydantic shape; types are
// hand-rolled (not pulled from `shared/types/api.ts`) for the same
// reason every other feature is — that file is doc-infrastructure,
// not the type SoT for consumers.
//
// `locked_until` is intentionally a string, not a Date: the BE
// stores the value as text to accommodate the far-future indefinite-
// lock sentinel that doesn't round-trip cleanly through datetime.
export interface AdminUserRow {
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  registered_at: string;
  last_active_at: string | null;
  // OTP-recoverable failed-login lock; stored as text so the
  // far-future indefinite-lock sentinel round-trips. Distinct from
  // `disabled_at` (admin-set, recovery-proof).
  locked_until: string | null;
  deleted_at: string | null;
  // BE T-admin B1 (`a13669e`) + A2/A3 backfill (`2bb48c6`) —
  // admin-set recovery-proof disable timestamp. null = active,
  // non-null = disabled-since.
  disabled_at: string | null;
  two_factor_enabled: boolean;
  session_count: number;
}

export interface AdminUserListResponse {
  users: AdminUserRow[];
  next_cursor: string | null;
  has_more: boolean;
}

const PAGE_LIMIT = 25;

export function fetchAdminUsers(args: {
  q: string;
  cursor?: string;
  include_deleted: boolean;
}): Promise<AdminUserListResponse> {
  return apiFetch<AdminUserListResponse>(
    routes.admin.users({
      q: args.q || undefined,
      cursor: args.cursor,
      include_deleted: args.include_deleted || undefined,
      limit: PAGE_LIMIT,
    })
  );
}

// `enabled` is `false` for non-admin callers so a non-admin landing
// on `/admin/users` (the second-line gate inside the page renders
// the "Not available" panel) doesn't burn a 403 round-trip. Empty `q`
// is the all-users case; short `q` (<3 chars) also keys an all-users
// fetch on the FE side per spec ("ignores ≤2 chars") — the BE will
// happily match a 1-char query but firing on every keystroke is
// wasteful.
export function useAdminUsersInfiniteQuery(
  params: AdminUsersListParams,
  enabled: boolean
) {
  const queryArg: AdminUsersListParams = {
    q: params.q.length > 2 ? params.q : '',
    include_deleted: params.include_deleted,
  };

  return useInfiniteQuery({
    queryKey: adminKeys.usersList(queryArg),
    queryFn: ({ pageParam }) =>
      fetchAdminUsers({
        q: queryArg.q,
        cursor: pageParam,
        include_deleted: queryArg.include_deleted,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.has_more && last.next_cursor ? last.next_cursor : undefined,
    enabled,
    // Inventory rarely changes; admin rerolls the page manually on
    // refresh + mutations (B1/B2) invalidate this key by hand.
    staleTime: 60_000,
  });
}
