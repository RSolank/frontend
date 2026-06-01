import { http, HttpResponse } from 'msw';

// BE Phase 2.2 (`ac4ad00`) — async statement-upload endpoints.
//
// Defaults below let tests for unrelated surfaces render through
// without per-test fixture wiring:
//   - POST /api/statement-uploads -> 202 {job_id: 1, status: 'PENDING'}
//   - GET  /api/statement-uploads/:job_id -> a terminal COMPLETE
//     payload (so the dock widget settles immediately when a test
//     happens to mount it without setting up the lifecycle)
//
// Tests that exercise the async lifecycle proper (e.g. PENDING ->
// PARSING -> COMPLETE transitions, 409 / 422 paths, FAILED states)
// override via `server.use(...)` with bespoke handlers.
export const statementUploadHandlers = [
  // BE handoff `GET /parsers` — default 404 (BE hasn't shipped the
  // route yet). The FE query gracefully falls back to its
  // hardcoded local catalog. Tests that exercise the live-catalog
  // path override this with a 200 + a custom parser list via
  // `server.use(...)`.
  http.get(
    'http://localhost:4000/api/statement-uploads/parsers',
    () => new HttpResponse(null, { status: 404 })
  ),
  http.post('http://localhost:4000/api/statement-uploads', () =>
    HttpResponse.json({ job_id: 1, status: 'PENDING' }, { status: 202 })
  ),
  http.get(
    'http://localhost:4000/api/statement-uploads/:jobId',
    ({ params }) =>
      HttpResponse.json({
        job_id: Number(params.jobId),
        status: 'COMPLETE',
        file_name: 'statement.csv',
        parser_used: 'phonepe',
        source_type: 'upi',
        txns_parsed: 0,
        txns_inserted: 0,
        error_detail: null,
        detected_identifier: null,
        bank_account_id: null,
        suggest_register_account: false,
        created_at: '2026-06-01T00:00:00Z',
        completed_at: '2026-06-01T00:00:01Z',
      })
  ),
];
