# Personal Budget — Frontend Contributing Guide

> [!NOTE]
> **Target spec.** This document is the *target* shape for the frontend after
> its refactor. The planning session on 2026-05-24 resolved every prior
> `TODO(planning)` — see §10 for the locked decision table. The current code
> under `src/pages/` and `src/components/` is the *baseline* the refactor will
> reshape into the layout described here.
>
> Mirrors [`backend/CONTRIBUTING.md`](../backend/CONTRIBUTING.md) in shape and
> intent.

---

## 🏗️ 1. Architecture & Design Principles

To match the backend's **feature-based (screaming) architecture**, the frontend
should reorganise from a "by-technical-layer" tree
(`pages/`, `components/`, `state/`, `utils/`) into a "by-business-feature"
tree (`features/transactions/`, `features/budgets/`, ...) so the same vocabulary
lines up across the wire.

### Core rules

- **KISS / DRY** — same defaults as the backend; prefer obvious code over
  clever abstractions.
- **Feature isolation** — every feature owns its components, hooks, API calls,
  routes, and tests under `src/features/<feature>/`. No cross-feature reaches.
- **Dependency direction** — features depend on `shared/`; `shared/` never
  imports a feature.
- **Endpoint vocabulary follows the backend** — feature names mirror
  `backend/app/modules/` (auth, users, metadata, tags, beneficiaries,
  transactions, categorization, taxation, budgets).

---

## 📁 2. Frontend Directory Structure (target)

```text
frontend/
├── src/
│   ├── app/                       # App shell — providers, router, top-level layout
│   │   ├── App.tsx
│   │   ├── routes.tsx             # createBrowserRouter composer; spreads per-feature route arrays
│   │   └── providers.tsx          # QueryClientProvider, store hydration, global ErrorBoundary
│   │
│   ├── features/                  # one folder per business feature (mirrors backend modules)
│   │   ├── auth/
│   │   │   ├── api/               # queries.ts, mutations.ts, keys.ts, schemas.ts
│   │   │   ├── components/        # auth-only UI pieces
│   │   │   ├── hooks/
│   │   │   ├── pages/             # LoginPage / RegisterPage / RecoveryPage
│   │   │   ├── state/             # useAuthStore (Zustand + persist)
│   │   │   └── auth.routes.tsx
│   │   ├── users/                 # profile + preferences
│   │   ├── metadata/              # CountrySelect, CurrencySelect, etc.
│   │   ├── tags/
│   │   ├── beneficiaries/
│   │   ├── transactions/          # + statement_upload/ subfolder mirroring backend
│   │   ├── categorization/
│   │   ├── taxation/              # consumption-tax bills + rules
│   │   └── budgets/
│   │
│   ├── shared/                    # cross-feature primitives
│   │   ├── api/                   # apiClient.ts (typed fetch + auth + error normalisation)
│   │   ├── components/            # ErrorBoundary, ProtectedRoute, design-system bits
│   │   ├── hooks/                 # generic hooks (useDebounce, useToast, ...)
│   │   ├── utils/                 # dateUtils, validation, formatters
│   │   └── types/                 # api.ts (generated from /openapi.json) + hand-rolled types
│   │
│   ├── test/                      # shared test infra — MSW handlers, server.ts, render helpers
│   │   ├── server.ts
│   │   └── handlers/<feature>.ts
│   │
│   ├── main.tsx                   # entrypoint
│   └── setupTests.ts              # vitest + happy-dom + jest-dom + MSW server start/stop
│
└── docs/
    ├── architecture.md            # high-level design, providers, routing, data-fetch story
    ├── modules/                   # one page per feature
    ├── testing.md
    ├── performance.md             # bundle budgets, lazy-load boundaries
    └── refactor/                  # historical: implementation_plan.md, etc.
```

### Layering inside a feature

```text
api/         data access — queries.ts, mutations.ts, keys.ts, schemas.ts (TanStack Query)
hooks/       feature-specific React hooks built on top of `api/`
components/  UI primitives scoped to this feature
pages/       route-mounted screens; thin — orchestrate hooks + components
state/       Zustand stores scoped to this feature (only when state crosses pages)
*.routes.tsx route table (RouteObject[]) for this feature; consumed by `app/routes.tsx`
*.test.tsx   co-located component / hook / page tests (MSW for network)
```

---

## 🛠️ 3. Tooling & Workflow

### Required toolchain

- **Node**: any LTS that ships with the current Vite line.
- **Package manager**: npm (lockfile committed as `package-lock.json`).
- **Bundler / dev server**: Vite (`npm run dev`, default port 5173).
- **Language**: **TypeScript (strict)** — `noUncheckedIndexedAccess` on,
  `allowJs` on during the per-feature migration. Backend response types are
  generated from `/openapi.json` into `src/shared/types/api.ts` via
  `openapi-typescript`.
- **Lint / format**: **ESLint** (flat config) + **Prettier**. Plugins:
  `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`,
  `eslint-plugin-import` (with `no-restricted-paths` enforcing the
  features → shared dependency direction from §1).
  `prettier-plugin-tailwindcss` handles class-name ordering.
- **Server state**: **TanStack Query v5** — every feature exposes
  `useXyzQuery` / `useXyzMutation` hooks from its `api/`. Devtools enabled in
  dev. `staleTime` and invalidation strategy per-feature, not global.
- **Client state**: **Zustand** — provider-free stores under
  `features/<feature>/state/`. One store per domain (no god-store). `persist`
  middleware for tokens (see `useAuthStore`).
- **Forms**: **react-hook-form** + **Zod**. Zod schemas live in each feature's
  `api/` folder and double as the TS request-body type via `z.infer`.
- **Styling**: **Tailwind CSS v4** via `@tailwindcss/vite`. Shared component
  patterns extract into `@layer components` blocks; long classNames are
  Prettier-sorted, not extracted prematurely. _Future option: revisit
  vanilla-extract if the project scales to need typed, zero-runtime styles
  with formal theming._
- **Test runner**: Vitest, `happy-dom`, `@testing-library/react`.
- **Backend mocking in tests**: **MSW (Mock Service Worker)** — handlers live
  in `src/test/handlers/<feature>.ts`. Tests exercise the real React Query
  path; `vi.mock(apiClient)` is no longer the default pattern.
- **Routing**: `react-router-dom` v6.4+ **data router** —
  `createBrowserRouter` consumes per-feature `RouteObject[]` arrays from
  `features/<feature>/<feature>.routes.tsx`, composed in `app/routes.tsx`.
  Each `RouteObject` carries its own `errorElement` (see §6) and a
  `lazy: () => import(...)` for code-split first paint. _Future option:
  migration to TanStack Router is a separate adoption, not part of this
  refactor._
- **Bundle budget**: ≤ **120 KB gzipped** first-paint JS, ≤ **80 KB gzipped**
  per per-feature lazy chunk; CSS ≤ 15 KB. Enforced via `size-limit` in CI
  (wired in Batch 9).

### Commands

```bash
cd frontend
npm install
npm run dev      # Vite dev server on :5173
npm run build    # production bundle
npm test         # vitest run (happy-dom env, single shot)
npx vitest       # vitest watch
npx vitest run src/features/auth/pages/LoginPage.test.jsx   # single file
```

`VITE_API_URL` overrides the API base (default `http://localhost:4000`).

---

## 🔒 4. Privacy, Security & Path Rules

### Absolute privacy of paths

- **No personal absolute paths** (e.g. `/home/...`, `/Users/...`) in source,
  comments, configs, or docs. Use relative paths from the project root.

### Browser-side security

- **Never log secrets** — `console.log(token)` in dev tools makes them visible
  in user devtools too. Strip access tokens from any debug log before
  committing.
- **No PII in URLs or query params** — keep `dob`/`contact` only inside POST
  bodies; the backend already filters them out of responses.
- **Sanitize HTML** anywhere `dangerouslySetInnerHTML` is used (currently
  nowhere — keep it that way unless there's a clear reason).
- **CSRF / cookies** — the backend issues a cookie + Bearer dual; the SPA
  uses Bearer + `localStorage` today. If that changes, audit every fetch
  call site.

### Dev/test environment

- `.env.local` for personal overrides (gitignored). Never commit a `.env`
  with real secrets.

---

## 📡 5. Data Fetching & Server State

### Current state (baseline)

`src/utils/apiClient.js` is a thin `fetch` wrapper used directly inside
`useEffect` blocks. Cache, retry, deduplication, and error normalisation are
all manual or absent.

### Target state

**TanStack Query v5** owns all server state. Each feature exposes
`useXyzQuery` / `useXyzMutation` hooks from its `api/` folder. Cache keys
are produced by a per-feature `keys.ts` factory (single source of truth for
invalidation). The cross-feature invalidation graph that motivates this
choice:

```text
useCreateTransactionMutation  → invalidates  ['transactions', 'budgets', ['taxation', 'current-week']]
useUpdateBudgetMutation       → invalidates  ['budgets', ['taxation', 'current-week']]
useCreateRuleMutation         → invalidates  ['categorization', 'rules']
```

Per-feature shape:

```text
features/<feature>/api/
├── queries.ts       # useXyzQuery hooks
├── mutations.ts     # useXyzMutation hooks
├── keys.ts          # cache-key factory
└── schemas.ts       # Zod schemas (request/response) → exported as TS types via z.infer
```

Rules:

- All API calls live in `src/features/<feature>/api/`. **Pages never call
  `fetch` directly.** A page imports a query/mutation hook and uses it.
- Underlying transport stays as `src/shared/api/apiClient.ts` (typed fetch
  wrapper with auth header + error normalisation). React Query's `queryFn`
  calls it.
- Response shapes are typed from `src/shared/types/api.ts` (generated from
  backend's `/openapi.json` via `openapi-typescript`). When in doubt about
  a shape, regenerate before guessing.

---

## 🧩 6. Component Design

- **Pages are thin** — they orchestrate feature hooks + components; they
  should not own significant logic.
- **Components are pure when possible** — receive everything they need via
  props; if they need data, take it from a hook the page passes down or
  call a feature hook themselves.
- **Co-locate tests** next to the component being tested: `Foo.tsx` and
  `Foo.test.tsx` in the same folder. Vitest picks them up automatically.
- **Avoid prop drilling beyond 2 levels** — promote to a feature-level
  context or a hook that does the lookup.
- **Accessibility** — every interactive element keyboard-reachable; labels
  on every input; semantic HTML over `<div onClick>`.

---

## 🧪 7. Testing

### Layout

- Co-locate `*.test.tsx` next to the component it tests. Vitest auto-discovers.
- Cross-cutting smoke tests (router rendering, providers compose) live in
  `src/app/` next to the shell.
- Shared test infrastructure (MSW handlers, render helpers, fixtures) lives
  under `src/test/` (singular). This is the **only** sanctioned non-colocated
  test location.
- A top-level `tests/` directory mirroring the backend layout is **not**
  used — colocation is required by the feature-isolation rule in §1.

### Coverage targets

- **Critical-path pages** (auth, transactions create/edit, budgets create,
  taxation bills view): **80% lines**.
- **Everything else**: **60% lines**.
- Enforced via `vitest --coverage`; reports go to `coverage/`. Wired in
  Batch 9, recorded in `docs/testing.md`.

### Mocking the backend

- **MSW** is the default. Handlers live in `src/test/handlers/<feature>.ts`
  and are composed in `src/test/server.ts`. `setupTests.ts` starts/stops the
  server with `beforeAll` / `afterAll` and resets between tests.
- React Query hooks run their full code path — cache, retry, error mapping.
  This keeps tests refactor-proof: rewriting `api/queries.ts` doesn't break
  the test surface.
- `vi.mock(apiClient)` is reserved for the rare case where a test cares about
  a specific transport-level concern (e.g. retry policy). It is no longer the
  default pattern.

---

## ⚡ 8. Performance & UX

- **Defer expensive work** to `useMemo` / `useCallback` only when a measured
  regression exists — don't pre-optimise.
- **Code-split** at the feature boundary: `const Lazy = lazy(() => import('./LazyPage'))`.
- **Suspense + ErrorBoundary** at every feature route's entry.
- **Skeleton loaders** for any list fetch > 200 ms.

---

## 📚 9. Documentation

Mirrors the backend's `docs/` shape so contributors don't context-switch:

```text
docs/
├── architecture.md       # design, layering, routing, data-fetch story
├── modules/<feature>.md  # one page per feature mirroring backend module docs
├── testing.md            # test layout, fixtures, run commands
└── refactor/             # historical — implementation_plan.md etc.
```

Same per-batch update rule as backend: **every batch updates the docs as
its closing step.**

---

## 🚧 10. Architectural Decisions (Resolved — Planning Session 2026-05-24)

The §10 open questions are now locked. The table below is the single source
of truth; the same choices are reflected throughout §3, §5, §7. Future
revisits should update this section and the corresponding section in lockstep.

| # | Decision | Choice | Future option |
|---|---|---|---|
| 1 | Test file location | Co-located `*.test.tsx`; `src/test/` for MSW handlers and shared infra only | — |
| 2 | Lint + format | ESLint flat config + Prettier + plugins (`react`, `react-hooks`, `jsx-a11y`, `import` with `no-restricted-paths`) + `prettier-plugin-tailwindcss` | Revisit Biome in ~12 months once `react-hooks/exhaustive-deps` and `jsx-a11y` equivalents land |
| 3 | Type system | **TypeScript strict**, `noUncheckedIndexedAccess`, `allowJs` during migration; OpenAPI → `src/shared/types/api.ts` via `openapi-typescript` | — |
| 4a | Server state | **TanStack Query v5** | — |
| 4b | Client state | **Zustand**, one store per domain, `persist` middleware for auth | — |
| 5 | Forms + validation | **react-hook-form + Zod**; Zod schemas double as TS request-body types | — |
| 6 | Styling | **Tailwind CSS v4** + `@layer components` for shared patterns; class sorting via Prettier plugin | Revisit **vanilla-extract** if/when the project scales to need typed, zero-runtime styles with formal theming |
| 7 | Backend mocking | **MSW**, handlers under `src/test/handlers/<feature>.ts`; `vi.mock(apiClient)` reserved for transport-level tests | — |
| 8 | Routing | `createBrowserRouter` + per-feature `RouteObject[]` + `protectedRoutes()` helper; per-route `lazy` for code-splitting | Migration to **TanStack Router** is a future adoption, not part of this refactor |
| 9 | Auth state | `useAuthStore` (Zustand + `persist`) replaces `AuthContext`; selector-based subscriptions | New stores added only when a concrete cross-page client-state need exists |
| 10 | Error boundaries | Global ErrorBoundary at app shell + per-feature `errorElement` on each `RouteObject` | Watch **Statement Upload** and **Weekly Tax generation** for crash frequency; add finer sub-route boundaries inside those pages if errors recur |
| 11 | Bundle budget | ≤ 120 KB gzipped first-paint JS, ≤ 80 KB per per-feature lazy chunk, ≤ 15 KB CSS; `size-limit` CI gate wired in Batch 9 | — |
