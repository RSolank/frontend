import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE Phase 1.5 (`f369ce2`) — recurring inference engine endpoints.
// Defaults below return empty arrays so the management page + the
// dashboard widget render their empty states without per-test
// fixture wiring. Tests that exercise specific shapes call
// `server.use(...)` with a fixture-bearing handler.
export const recurringHandlers = [
  http.get(`${API_BASE}/recurring/templates`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/recurring/upcoming`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/recurring/history`, () => HttpResponse.json([])),
  // Mutations: minimal happy-path stubs so per-test overrides only
  // need to supply the rare error cases. POST returns a 201 with an
  // echoed-back template that has uid=1 + every required field
  // defaulted; PATCH echoes the body merged onto a stub row; DELETE
  // returns 204.
  http.post(`${API_BASE}/recurring/templates`, async () =>
    HttpResponse.json(
      {
        uid: 1,
        beneficiary_id: 1,
        debit_credit: 'debit',
        pattern_type: 'FIXED_AMOUNT',
        expected_amount: 0,
        amount_tolerance: 0.15,
        cadence: 'MONTHLY',
        cadence_interval: 1,
        day_of_month: null,
        day_of_week: null,
        week_of_month: null,
        anchor_date: '2026-06-01',
        next_due_date: '2026-06-01',
        status: 'locked',
        active: true,
        occurrence_count: 0,
        last_seen_date: null,
        last_confirmed_date: null,
        created_at: '2026-06-01T00:00:00Z',
      },
      { status: 201 }
    )
  ),
  http.patch(`${API_BASE}/recurring/templates/:uid`, async ({ params }) =>
    HttpResponse.json({
      uid: Number(params.uid),
      beneficiary_id: 1,
      debit_credit: 'debit',
      pattern_type: 'FIXED_AMOUNT',
      expected_amount: 0,
      amount_tolerance: 0.15,
      cadence: 'MONTHLY',
      cadence_interval: 1,
      day_of_month: null,
      day_of_week: null,
      week_of_month: null,
      anchor_date: '2026-06-01',
      next_due_date: '2026-06-01',
      status: 'locked',
      active: true,
      occurrence_count: 0,
      last_seen_date: null,
      last_confirmed_date: null,
      created_at: '2026-06-01T00:00:00Z',
    })
  ),
  http.delete(
    `${API_BASE}/recurring/templates/:uid`,
    () => new HttpResponse(null, { status: 204 })
  ),
];
