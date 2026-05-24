import { http, HttpResponse } from 'msw';

// Stub endpoint that backs the Batch 0 useQuery smoke test in
// src/App.smoke.test.tsx. Feature batches add their own handlers under
// src/test/handlers/<feature>.ts and compose them in handlers/index.ts.
export const healthHandlers = [
  http.get('http://localhost:4000/api/health', () =>
    HttpResponse.json({ status: 'ok' })
  ),
];
