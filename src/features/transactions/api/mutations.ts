import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type {
  TransactionCreatePayload,
  TransactionUpdatePayload,
} from './schemas';

// POST /api/transactions[?rule_id=…] — backend optionally links a
// freshly-created categorization rule to the new transaction.
// Response shape: { transaction: { txn_id, ... } }.
export interface CreateTransactionResponse {
  transaction: { txn_id: number };
}

export function createTransactionRequest(
  payload: TransactionCreatePayload,
  ruleId?: number | null
): Promise<CreateTransactionResponse> {
  const qs = ruleId ? `?rule_id=${ruleId}` : '';
  return apiFetch<CreateTransactionResponse>(
    `${routes.transactions.create()}${qs}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function updateTransactionRequest(
  id: number | string,
  payload: TransactionUpdatePayload,
  ruleId?: number | null
): Promise<unknown> {
  const qs = ruleId ? `?rule_id=${ruleId}` : '';
  return apiFetch<unknown>(`${routes.transactions.byId(id)}${qs}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// `onPayment` only matters when the deleted txn settled a consumption-tax
// bill: 'reopen' un-settles the bill(s) it backed; 'preserve' (default) keeps
// them paid (the backend's allocation survives via FK SET NULL). Omitted for
// ordinary txns.
export function deleteTransactionRequest(
  id: number | string,
  opts?: { onPayment?: 'reopen' | 'preserve' }
): Promise<unknown> {
  const qs = opts?.onPayment ? `?on_payment=${opts.onPayment}` : '';
  return apiFetch<unknown>(`${routes.transactions.byId(id)}${qs}`, {
    method: 'DELETE',
  });
}

// BE Phase 2.2 (`ac4ad00`) — the legacy 4-step synchronous upload
// pipeline (`/upload-statement` + map-beneficiaries + categorize +
// finalize) is retired. The async surface
// (`uploadStatementJobRequest`, `useJobStatusQuery`,
// `manualTagTransactionRequest`) now lives at
// [`statement_upload/api/`](../statement_upload/api).
