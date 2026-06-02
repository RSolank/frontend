// Test-side base URL for MSW handlers + per-test `server.use(...)`
// overrides. Mirrors the `const V` knob in
// `src/shared/api/routes.ts` — the FE carries two flip points for
// API-version cutovers: this file (test surface) and `routes.ts`
// (runtime surface). Both flipped to `/api/v1` for BE Phase 2.11
// (T-api-v1-prefix). A future v2 is the same two-const change plus
// `npm run gen:api` to refresh `src/shared/types/api.ts`.
//
// Host portion (`http://localhost:4000`) is hardcoded because tests
// run under happy-dom + MSW interception — `VITE_API_URL` isn't
// read in the test environment.
export const API_BASE = 'http://localhost:4000/api/v1';
