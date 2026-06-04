import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch, type ApiError } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { adminKeys, type AdminCemeteryListParams } from './keys';

// BE T-admin C1 (`d76f6a5`) — cemetery audit. The cemetery is the
// *post-purge* tombstone; `deleted_at` is the entomb timestamp (no
// scheduled-purge field — that already happened by the time a row
// lands here). `email` is the one PII field the cemetery retains.

export interface AdminCemeteryRow {
  deleted_user_id: number;
  former_user_id: number;
  email: string | null;
  deleted_at: string;
  account_opened_at: string | null;
  country: string | null;
  currency: string | null;
  committee_bill_replicas_count: number;
  expense_total_replicas_count: number;
}

export interface AdminCemeteryListResponse {
  deleted_users: AdminCemeteryRow[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface AdminCemeteryBillReplica {
  original_bill_id: number;
  amount: number;
  bill_status: string;
  period_start: string;
  period_end: string;
  billed_at: string;
}

export interface AdminCemeteryExpenseReplica {
  period_type: string;
  period_start: string;
  period_end: string;
  total_count: number;
  total_debit: number;
  total_credit: number;
}

export interface AdminCemeteryDetail extends AdminCemeteryRow {
  committee_bill_replicas: AdminCemeteryBillReplica[];
  expense_total_replicas: AdminCemeteryExpenseReplica[];
}

const PAGE_LIMIT = 25;

export function fetchAdminCemeteryList(args: {
  q: string;
  from: string | null;
  to: string | null;
  cursor?: string;
}): Promise<AdminCemeteryListResponse> {
  return apiFetch<AdminCemeteryListResponse>(
    routes.admin.cemetery({
      q: args.q || undefined,
      from: args.from ?? undefined,
      to: args.to ?? undefined,
      cursor: args.cursor,
      limit: PAGE_LIMIT,
    })
  );
}

export function fetchAdminCemeteryDetail(
  deletedUserId: number
): Promise<AdminCemeteryDetail> {
  return apiFetch<AdminCemeteryDetail>(
    routes.admin.cemeteryDetail(deletedUserId)
  );
}

export function useAdminCemeteryInfiniteQuery(
  params: AdminCemeteryListParams,
  enabled: boolean
) {
  // ≤2-char queries collapse to empty (mirror the user-list debounce
  // gate) — no point flooding the BE on partial typing.
  const queryArg: AdminCemeteryListParams = {
    q: params.q.length > 2 ? params.q : '',
    from: params.from,
    to: params.to,
  };

  return useInfiniteQuery({
    queryKey: adminKeys.cemeteryList(queryArg),
    queryFn: ({ pageParam }) =>
      fetchAdminCemeteryList({
        q: queryArg.q,
        from: queryArg.from,
        to: queryArg.to,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.has_more && last.next_cursor ? last.next_cursor : undefined,
    enabled,
    staleTime: 60_000,
  });
}

export function useAdminCemeteryDetailQuery(
  deletedUserId: number,
  enabled: boolean
) {
  return useQuery<AdminCemeteryDetail, ApiError>({
    queryKey: adminKeys.cemeteryDetail(deletedUserId),
    queryFn: () => fetchAdminCemeteryDetail(deletedUserId),
    enabled,
    staleTime: 60_000,
  });
}
