import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type {
  TransactionCreatePayload,
  TransactionUpdatePayload,
  UploadResult,
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
  return apiFetch<CreateTransactionResponse>(`${routes.transactions.create()}${qs}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

export function deleteTransactionRequest(
  id: number | string
): Promise<unknown> {
  return apiFetch<unknown>(routes.transactions.byId(id), { method: 'DELETE' });
}

// Statement-upload pipeline — three sequential POSTs.
//   1. /upload-statement       — parses file, inserts raw rows
//   2. /upload-statement/:id/map-beneficiaries — links to existing beneficiaries
//   3. /upload-statement/:id/categorize        — runs categorization engine
//
// Plus the manual-tags + finalize endpoints used by the per-row review
// flow.
export function uploadStatementRequest(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<UploadResult>(routes.transactions.uploadStatement(), {
    method: 'POST',
    body: fd,
  });
}

export function mapBeneficiariesRequest(
  uploadId: number | string
): Promise<unknown> {
  return apiFetch<unknown>(
    routes.transactions.uploadStatementMapBeneficiaries(uploadId),
    { method: 'POST' }
  );
}

export function categorizeUploadRequest(
  uploadId: number | string
): Promise<UploadResult> {
  return apiFetch<UploadResult>(
    routes.transactions.uploadStatementCategorize(uploadId),
    { method: 'POST' }
  );
}

export function saveManualTagsRequest(
  txnId: number | string,
  tagIds: number[]
): Promise<unknown> {
  return apiFetch<unknown>(routes.transactions.manualTags(txnId), {
    method: 'POST',
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

export type FinalizeDecision = 'commit' | 'set_misc' | 'rollback';

export function finalizeUploadRequest(
  uploadId: number | string,
  decision: FinalizeDecision
): Promise<unknown> {
  return apiFetch<unknown>(
    routes.transactions.uploadStatementFinalize(uploadId),
    {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }
  );
}
