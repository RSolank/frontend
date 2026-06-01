# Frontend Testing

> Canonical rules live in
> [CONTRIBUTING.md §7](../CONTRIBUTING.md#-7-testing); this page is the
> operational companion (MSW lifecycle, handler recipes, coverage).

## Stack (locked in CONTRIBUTING.md §10)

| Concern | Choice |
|---|---|
| Runner | **Vitest** (`npm test` = `vitest run`; `npx vitest` watches) |
| DOM env | **happy-dom** (configured in `vite.config.mts`) |
| Assertion lib | `@testing-library/react` + `@testing-library/jest-dom` |
| Backend mock | **MSW** — handlers in `src/test/handlers/<feature>.ts`; server in `src/test/server.ts`; lifecycle in `src/setupTests.ts`. Every handler URL flows through `API_BASE` from `src/test/baseUrl.ts` so the v1-prefix cutover is one const flip (see `docs/architecture.md` → Data fetching). |
| Layout | **Co-located** `*.test.tsx` next to the file under test; `src/test/` is reserved for shared infra (MSW server, handlers, render helpers) |

## MSW lifecycle (live as of Batch 0)

`src/setupTests.ts` runs:

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

The `error` mode means any test that hits a real fetch without a
matching handler fails. Tests can register one-off handlers via
`server.use(...)` inside the test body.

## Known issue — the committed service worker

`public/mockServiceWorker.js` is committed deliberately (so a future
browser-mode MSW or Storybook setup can adopt it), but the app never
calls `worker.start()`, so it should never run. If it ever gets
registered as a browser service worker it **silently breaks login and
every dev fetch**: the console shows `TypeError: Failed to fetch`,
DevTools → Network shows no request at all, and the backend logs
nothing.

- **Diagnose:** DevTools → Application → Service Workers; if
  `mockServiceWorker.js` is listed, it's the culprit.
- **Fix:** DevTools → Application → Storage → "Clear site data" (or
  "Unregister" on the SW entry).
- **Kill-switch (if it recurs):** delete `public/mockServiceWorker.js`
  outright — nothing in the codebase needs it; `npx msw init public/
  --save` regenerates it when a batch actually adopts browser MSW.

## Adding a feature handler

1. Drop a file in `src/test/handlers/<feature>.ts` exporting a handler
   array (e.g. `export const beneficiaryHandlers = [http.get(...)]`).
2. Include it in `src/test/handlers/index.ts`.
3. Write tests against the real query hook — no `vi.mock(apiClient)`.

The Batch 0 working example is
[`src/test/useQuery.smoke.test.tsx`](../src/test/useQuery.smoke.test.tsx)
served by [`src/test/handlers/health.ts`](../src/test/handlers/health.ts).

## Coverage

`npm run coverage` (`vitest run --coverage`, v8 provider) reports to
`coverage/` (gitignored). `npm test` stays coverage-free so the dev loop
is fast. Config lives in the `test.coverage` block of `vite.config.mts`;
`testTimeout` is 15s there (v8 instrumentation overhead would otherwise
trip the async, `waitFor`-heavy page tests at the 5s default).

**Targets** (CONTRIBUTING.md §7):

| Surface | Target |
|---|---|
| Critical-path pages — auth, transactions create/edit, budgets create, taxation bills view | 80% lines |
| Everything else | 60% lines |

**Enforced now:** a **60% global floor** (lines / branches / functions /
statements) — the "everything else" target — as a `thresholds` block.
**Measured at the refactor merge (Batch 10):** lines 70.1% · statements
68.7% · functions 65.3% · branches 61.5%. The 80% critical-path target
needs per-glob thresholds on those pages (and a coverage bump to meet
them); that plus a CI gate is a tracked post-refactor follow-up.
