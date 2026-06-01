import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// Stub endpoint that backs the Batch 0 useQuery smoke test in
// src/App.smoke.test.tsx. Feature batches add their own handlers under
// src/test/handlers/<feature>.ts and compose them in handlers/index.ts.
export const healthHandlers = [
  http.get(`${API_BASE}/health`, () =>
    HttpResponse.json({ status: 'ok' })
  ),
];
