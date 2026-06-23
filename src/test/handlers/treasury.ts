import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE T-treasury — `/treasury/summary` (reconcile-on-read). Default returns a
// zeroed summary so the Savings page renders its empty state without per-test
// fixture wiring. Tests that exercise the populated zones call
// `server.use(...)` with a fixture-bearing handler.
export const treasuryHandlers = [
  http.get(`${API_BASE}/treasury/summary`, () =>
    HttpResponse.json({
      funded_balance: 0,
      recognized_revenue: 0,
      deferred_balance: 0,
      provisioned_total: 0,
      currency: 'INR',
      trend: [],
    })
  ),
];
