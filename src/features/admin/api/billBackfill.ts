import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

// BE Phase 2.6 — admin bill-generate (T-taxation `e7c05aa`) ships
// `POST /api/v1/consumption-tax/admin/bills/generate`. Bypasses the
// auto-mode guard so it works against auto-enabled users too.
// T-admin D1 wraps it in a UI form (`/admin/ops/bill-backfill`).

export interface AdminBillGenerateRequest {
  user_id: number;
  period_start: string;
  period_end: string;
}

export interface BillGenerateResponse {
  bill_ids: number[];
}

export function adminGenerateBills(
  body: AdminBillGenerateRequest
): Promise<BillGenerateResponse> {
  return apiFetch<BillGenerateResponse>(routes.taxation.adminBillGenerate(), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

// Mutation hook with no invalidations — backfill writes to bills,
// but the operator doesn't browse the target user's bills inline
// in this surface (their detail page doesn't show bills either).
// Session-local log on the page is the only consumer of the result.
export function useAdminGenerateBillsMutation() {
  return useMutation({ mutationFn: adminGenerateBills });
}
