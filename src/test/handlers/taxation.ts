import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE Phase 2.6 (`e7c05aa`) — bill state machine endpoints.
// Defaults below return 404 (no bill provided) so per-test handlers
// can override with the right bill_id via `server.use(...)`. Tests
// that exercise mark-paid / mark-unpaid stub the matching response.
export const taxationHandlers = [
  http.post(
    `${API_BASE}/consumption-tax/bills/:billId/mark-paid`,
    async ({ params }) => {
      const billId = Number(params.billId);
      return HttpResponse.json({
        status: 'PAID',
        bill_id: billId,
        amount_paid: 0,
      });
    }
  ),
  http.post(
    `${API_BASE}/consumption-tax/bills/:billId/mark-unpaid`,
    async ({ params }) => {
      const billId = Number(params.billId);
      return HttpResponse.json({
        status: 'BILLED',
        bill_id: billId,
      });
    }
  ),
  // BE Phase 2.6 admin/ops backfill (T-admin D1 wraps this).
  // Default returns one bill id so the FE log block lights up; tests
  // that exercise empty / multi-bill responses override.
  http.post(`${API_BASE}/consumption-tax/admin/bills/generate`, () =>
    HttpResponse.json({ bill_ids: [9001] })
  ),
];
