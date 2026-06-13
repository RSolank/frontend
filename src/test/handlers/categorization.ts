import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// Default handler for the categorization-rules feature. Returns an empty rule
// list so tests that don't care about rules stay green (the transaction-entry
// forms load this on mount for tag auto-populate). Tests that exercise the
// rule flow override via `server.use(...)`.
export const categorizationHandlers = [
  http.get(`${API_BASE}/categorization-rules`, () =>
    HttpResponse.json({ rules: [] })
  ),
];
