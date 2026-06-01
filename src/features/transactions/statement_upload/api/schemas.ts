// BE Phase 2.2 (`ac4ad00`) — async statement-upload job DTOs.
//
// The job lifecycle: PENDING -> PARSING -> CATEGORIZING ->
// {COMPLETE | FAILED}. Backend marks non-terminal jobs FAILED on
// restart (user re-uploads); a weekly cleanup worker reaps stale
// jobs. `error_detail` is populated on FAILED; the FE renders it as
// the body of the failure card.

export type JobStatus =
  | 'PENDING'
  | 'PARSING'
  | 'CATEGORIZING'
  | 'COMPLETE'
  | 'FAILED';

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  'COMPLETE',
  'FAILED',
];

export function isTerminalStatus(status: JobStatus | undefined): boolean {
  return status === 'COMPLETE' || status === 'FAILED';
}

// 202 body — the job was queued. The FE stashes `job_id` and starts
// polling; `status` here is always `PENDING` in the current BE
// implementation but typed as `JobStatus` so future async kick-offs
// (e.g. instant-categorization fast paths) read it correctly.
export interface UploadAcceptedResponse {
  job_id: number;
  status: JobStatus;
}

// Full poll payload. `suggest_register_account` is `true` when an
// owner identifier was detected (e.g. UPI handle in a PhonePe
// statement) but no registered bank account matched — the dashboard
// dock surfaces a passive informational toast in Batch 12d (the
// actual register-an-account flow lands with bank-accounts.crud in
// Batch 13).
export interface JobStatusResponse {
  job_id: number;
  status: JobStatus;
  file_name: string | null;
  parser_used: string | null;
  source_type: string | null;
  txns_parsed: number;
  txns_inserted: number;
  error_detail: string | null;
  detected_identifier: string | null;
  bank_account_id: number | null;
  suggest_register_account: boolean;
  created_at: string;
  completed_at: string | null;
}

// One row of the parser catalog. The shape mirrors the BE's
// `available_parsers()` helper (see backend/app/modules/transactions/
// statement_upload/parsers/registry.py): `key` is the registry key
// (the "parser class" the FE supplies as `parser_override`),
// `label` is the display string, `source_type` is the wire tag
// the BE will persist on resulting transactions.
//
// A parser key is a CLASS of parsers belonging to a financial
// institution (e.g. `phonepe` may resolve to one of several
// PhonePe variants on the BE). The FE always supplies the class;
// the BE picks the specific variant.
export interface ParserOption {
  key: string;
  label: string;
  source_type: string;
}

// Hardcoded fallback catalog — used when the BE GET /parsers route
// isn't shipped yet (graceful degrade) so the picker still works.
// Mirrors the two parsers shipped at Batch 12 land
// (backend Phase 2.2, `ac4ad00`). When BE ships GET /parsers, the
// live catalog wins and this list becomes a pure safety net.
export const HARDCODED_PARSER_CATALOG: readonly ParserOption[] = [
  { key: 'phonepe', label: 'PhonePe statement (PDF)', source_type: 'phonepe' },
  { key: 'csv', label: 'Generic CSV statement', source_type: 'csv' },
] as const;

// 422 envelope — the file couldn't be matched to any registered
// parser with high enough confidence. The BE returns the list of
// available parsers (same shape as `available_parsers()`); the FE
// surfaces a "Pick parser" button that opens the parser picker
// modal pre-seeded with the matching parser. The BE also accepts
// `parser_override` as a form field, so a confirmed pick retries
// the upload with the user's choice.
export interface NoParserDetectedDetail {
  message: string;
  available_parsers: ParserOption[];
}

// Coerce a thrown `ApiError`'s detail into the typed envelope when
// possible — returns `null` for everything that isn't shaped like
// the BE 422 body, so the page falls back to the generic error
// renderer. Tolerates both the legacy `string[]` and the new
// `ParserOption[]` shapes (the BE field name is the same and we
// don't want a transient shape change during the BE rollout to
// break the FE).
export function extractNoParserDetail(
  detail: unknown
): NoParserDetectedDetail | null {
  if (!detail || typeof detail !== 'object') return null;
  const candidate = detail as {
    message?: unknown;
    available_parsers?: unknown;
  };
  if (
    typeof candidate.message !== 'string' ||
    !Array.isArray(candidate.available_parsers)
  )
    return null;
  return {
    message: candidate.message,
    available_parsers: candidate.available_parsers
      .map(coerceParserOption)
      .filter((v): v is ParserOption => v !== null),
  };
}

function coerceParserOption(raw: unknown): ParserOption | null {
  if (typeof raw === 'string') {
    // Legacy shape — BE used to return a flat string list. Promote
    // to the structured shape with the key reused as the label so
    // the picker still renders something readable.
    return { key: raw, label: raw, source_type: raw };
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { key?: unknown; label?: unknown; source_type?: unknown };
  if (typeof r.key !== 'string') return null;
  return {
    key: r.key,
    label: typeof r.label === 'string' ? r.label : r.key,
    source_type:
      typeof r.source_type === 'string' ? r.source_type : r.key,
  };
}
