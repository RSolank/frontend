import { apiFetch } from '../../../../shared/api/apiClient';
import { routes } from '../../../../shared/api/routes';

import type { UploadAcceptedResponse } from './schemas';

// POST /api/statement-uploads — multipart upload. Returns 202 +
// `{job_id, status}` immediately; the heavy parse runs in a
// FastAPI BackgroundTask. The caller is responsible for stashing
// `job_id` (typically in the `useStatementUploadJobStore` Zustand
// slice) and starting the poll loop via `useJobStatusQuery(job_id)`.
//
// `parserOverride` is the FE's parser-class pick — the BE registry
// key (e.g. `phonepe`, `csv`). When supplied, BE is asked to skip
// its own detection and route directly to that parser class; the
// BE may still fall back to detection if parsing with the chosen
// class fails (BE remains source-of-truth for parser selection
// when the user's pick doesn't pan out). When omitted, BE
// auto-detects as before.
//
// Note: the `parser_override` form field is part of the open BE
// handoff filed alongside this batch. Until BE ships the route
// signature, FastAPI ignores the unknown form field silently —
// the upload still succeeds via auto-detection, so the FE shipping
// ahead is graceful.
//
// Throws the apiClient's `ApiError` envelope on:
//   - 409 (duplicate file_hash — same user re-uploaded the same file)
//   - 422 (no parser detected; `detail` is shaped as
//     `{ message, available_parsers }` — use `extractNoParserDetail`
//     to coerce).
export function uploadStatementJobRequest(
  file: File,
  parserOverride?: string | null
): Promise<UploadAcceptedResponse> {
  const fd = new FormData();
  fd.append('file', file);
  if (parserOverride) fd.append('parser_override', parserOverride);
  return apiFetch<UploadAcceptedResponse>(routes.statementUploads.root(), {
    method: 'POST',
    body: fd,
  });
}

// POST /api/transactions/{txn_id}/manual-tags — re-tag a
// statement-imported transaction. The BE rejects manual re-tag on
// `source=manual` rows (403); manual rows go through the standard
// PATCH /api/transactions/{id} path instead. Reserved for the
// transactions DetailModal's tag-editor on imported rows.
export interface ManualTagsResponse {
  status: string;
  txn_id: number;
  tag_ids: number[];
}

export function manualTagTransactionRequest(
  txnId: number | string,
  tagIds: number[]
): Promise<ManualTagsResponse> {
  return apiFetch<ManualTagsResponse>(routes.transactions.manualTags(txnId), {
    method: 'POST',
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}
