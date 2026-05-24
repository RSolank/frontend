# Frontend Testing

> Skeleton — Batch 9 fills in the coverage numbers and the worked
> recipes. Until then, the canonical rules are
> [CONTRIBUTING.md §7](../CONTRIBUTING.md#-7-testing).

## Stack (locked in CONTRIBUTING.md §10)

| Concern | Choice |
|---|---|
| Runner | **Vitest** (`npm test` = `vitest run`; `npx vitest` watches) |
| DOM env | **happy-dom** (configured in `vite.config.mts`) |
| Assertion lib | `@testing-library/react` + `@testing-library/jest-dom` |
| Backend mock | **MSW** — handlers in `src/test/handlers/<feature>.ts`; server in `src/test/server.ts`; lifecycle in `src/setupTests.ts` |
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

## Adding a feature handler

1. Drop a file in `src/test/handlers/<feature>.ts` exporting a handler
   array (e.g. `export const beneficiaryHandlers = [http.get(...)]`).
2. Include it in `src/test/handlers/index.ts`.
3. Write tests against the real query hook — no `vi.mock(apiClient)`.

The Batch 0 working example is
[`src/test/useQuery.smoke.test.tsx`](../src/test/useQuery.smoke.test.tsx)
served by [`src/test/handlers/health.ts`](../src/test/handlers/health.ts).

## Legacy `vi.mock` tests

The pre-refactor tests under `src/pages/**/*.test.jsx` still use
`vi.mock('./utils/apiClient.js')`. They keep passing because they
short-circuit before fetch — MSW never sees them. Each feature batch
(2–8) rewrites its own tests against MSW handlers as it moves the
feature.

## Coverage targets (wired in Batch 9)

| Surface | Target |
|---|---|
| Critical-path pages — auth, transactions create/edit, budgets create, taxation bills view | 80% lines |
| Everything else | 60% lines |

`vitest --coverage` reports to `coverage/`. Threshold enforcement and
per-feature numbers land in Batch 9.
