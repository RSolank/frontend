// Test-side base URL for MSW handlers + per-test `server.use(...)`
// overrides. Mirrors the `const V` knob in
// `src/shared/api/routes.ts` — the FE only carries two flip points
// for the eventual `/api/v1/*` cutover: this file (test surface) and
// `routes.ts` (runtime surface). At v1 flip both consts change in
// lockstep; the type-regen path (`npm run gen:api`) catches the
// generated paths shape.
//
// Host portion (`http://localhost:4000`) is hardcoded because tests
// run under happy-dom + MSW interception — `VITE_API_URL` isn't
// read in the test environment.
export const API_BASE = 'http://localhost:4000/api';
