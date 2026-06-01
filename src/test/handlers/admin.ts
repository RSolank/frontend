import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE Phase 1.11 — `GET /api/admin/ping` returns 200 for the ADMIN
// role and 403 otherwise. Default to 403 (the common "regular user"
// path); the AdminLandingPage test + the TopNav admin-link test
// override with 200 via `server.use(...)`.
export const adminHandlers = [
  http.get(`${API_BASE}/admin/ping`, () =>
    HttpResponse.json({ detail: 'Insufficient privileges' }, { status: 403 })
  ),
];
