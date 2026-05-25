# Personal Budget — Frontend Contributing Guide

> [!NOTE]
> **Target spec.** This document is the _target_ shape for the frontend after
> its refactor. The planning session on 2026-05-24 resolved every prior
> `TODO(planning)` — see §10 for the locked decision table. The current code
> under `src/pages/` and `src/components/` is the _baseline_ the refactor will
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

### Platform target

The app is **web-first** for the current roadmap — the canonical
experience is a desktop browser. A native mobile app is a planned
future track (separate codebase / project), **not** part of this
refactor.

However, the web app must **resize gracefully so users opening it in
a phone or tablet browser can use it comfortably**. Concretely:

- No horizontal scrolling on `body` at any viewport ≥ 320 px.
- Every interactive control is reachable and large enough to tap
  (target ≥ 44 px on touch viewports).
- Tables and other data-dense surfaces degrade to a usable form on
  narrow viewports (horizontal scroll inside the surface, or a
  card/list fallback — the owning feature batch decides which fits
  its data).
- Modals, dropdowns, headers, and forms reflow rather than overflow.

The concrete breakpoint contract + per-batch responsibility lives in
§6 "Visual design language → Responsive design". Batch 9's verification
pass audits that every shipped feature honors it.

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

### User preferences contract (currency + timezone)

The backend's `UserPreferencesMiddleware`
([`backend/app/core/middleware.py`](../backend/app/core/middleware.py))
reads two headers from every incoming request and binds them to
`request.state.preferences` + a `ContextVar` that the service layer
queries via `get_current_preferences()`:

| Header | Default if absent | Source on frontend |
|---|---|---|
| `x-user-currency` | `USD` | `usePreferencesStore.currency` |
| `x-user-timezone` | `UTC` | `usePreferencesStore.timezone` |

**The frontend is responsible for sending both on every authenticated
request** so the backend's timezone-sensitive logic and currency-aware
formatting see the user's real preferences rather than the defaults.

**Where the values come from:**

- After login (and after token refresh / profile save), the auth flow
  calls `GET /api/users/preferences` — returns
  `{currency, country, timezone}` (currency/country from the profile row,
  timezone resolved by the middleware from the country lookup).
- The response populates `usePreferencesStore` (Zustand, in
  `src/shared/state/preferences.store.ts` — **must live in `shared/`
  because `shared/api/apiClient.ts` reads from it; `shared/` cannot
  depend on `features/`**).
- `apiClient.ts` injects both headers on every request, reading from the
  store on each call.

**Rules every batch must follow:**

- **No raw amount formatting.** Every user-facing amount goes through
  `shared/utils/currency.ts → formatMoney(amount, code, symbol)`. The
  helper renders `${symbol}${amount}` when a symbol is available and
  falls back to `${code} ${amount}` when it isn't. Never use
  `(amount).toLocaleString()` directly in a component — that drops the
  currency entirely.
- **No raw date formatting.** Every user-facing date/time goes through
  `shared/utils/dateUtils.ts` helpers, which take the active timezone
  from the store and pass it to `Intl.DateTimeFormat` via the
  `timeZone` option. Never call `new Date(iso).toLocaleDateString()`
  in a component.
- **No UTC-derived "today" defaults in forms.** `new Date().toISOString().split('T')[0]`
  is wrong for users east of UTC after ~6 PM local. Use
  `todayInUserTz(tz)` from `dateUtils` for default date-input values.
- **Form submission converts back.** Date inputs are interpreted in the
  user's tz; `localToUtcIso(localDateString, tz)` produces the ISO
  string sent to the backend.
- **Currency dropdowns show both code and symbol.** `${code} (${symbol})`
  format in `<CurrencySelect />` so users recognise either notation.
  When `symbol` is null, render just `${code}`.

The full staging across batches is captured in
[`docs/refactor/implementation_plan.md`](docs/refactor/implementation_plan.md)
(Batches 1, 2, 3, and the audit step in Batch 9).

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

### Visual design language

The refactor is also the moment to **upgrade the app's visual surface to
a modern, sleek, premium feel** — reference tier: Linear / Stripe /
Vercel / Notion. The pre-refactor look (plain CSS, generic forms,
minimal polish) is the _baseline to leave behind_, not the bar to clear.

**Operating principle:** every time a component is moved during a feature
batch, also upgrade its visuals to the new design language. Do not
re-skin the old plain look behind Tailwind utilities. A move + visual
upgrade in one batch is cheaper than two passes.

**Concrete elements of the target language:**

- **Whitespace and rhythm.** Generous padding; consistent vertical
  spacing scale (Tailwind's `space-y-*` / `gap-*` from a small set of
  values — e.g. 2, 3, 4, 6, 8). No tight, dense layouts unless data
  density is the point (transaction tables can be tight; forms cannot).
- **Type hierarchy.** Clear weight contrast: page titles bold/semibold,
  body regular, supporting text muted. Limit to ~3 sizes per screen.
  Use a system font stack or one well-chosen webfont (Inter / Geist /
  system-ui), set globally — no per-component font surprises.
- **Color discipline.** A restrained neutral palette + one accent + a
  small set of semantic colors (success, warning, error, info). Defined
  once in Tailwind's `@theme` block, referenced everywhere; no ad-hoc
  hex values inside components.
- **Corners and surfaces.** Small-to-medium rounded corners
  (`rounded-md` / `rounded-lg`); subtle shadows (`shadow-sm` /
  `shadow-md`) for elevated surfaces (cards, modals, dropdowns). No
  harsh borders; if a border is needed, use a low-contrast neutral.
- **Motion.** Smooth transitions on hover/focus/active state changes,
  ~150ms ease-out. `transition-colors`, `transition-shadow`,
  `transition-transform` — never `transition-all`. Reduced-motion users
  (`prefers-reduced-motion`) get instantaneous transitions.
- **Interactive feedback on everything.** Every clickable element has
  hover + focus + active states. Visible focus rings (don't suppress
  `:focus-visible`). Disabled buttons look obviously disabled.
- **Dark mode from day one.** Use Tailwind's `dark:` variant on every
  component as it's built. Don't defer dark-mode to a later pass — it's
  cheap if done as you go, painful retroactively. The theme
  infrastructure and a header `<ThemeToggle />` (light / dark / system)
  land in Batch 1 alongside the app shell, so every subsequent batch's
  dark styling is verifiable as it's written.
- **Responsive design from day one** — same posture as dark mode. The
  app is web-first today and a native mobile app is a future track
  (see §1 "Platform target"), but **every batch must make its surfaces
  resize comfortably to phone / tablet browser widths and to narrow
  desktop windows** (split-screen, docked panels). Retrofitting
  responsive at Batch 9 is the trap to avoid; the feature author knows
  best how their layout should degrade.
  - **Breakpoint contract** (Tailwind defaults): `sm` 640 px,
    `md` 768 px, `lg` 1024 px, `xl` 1280 px. Design mobile-first —
    base styles target the narrowest viewport, breakpoints layer on
    desktop niceties.
  - **Touch targets ≥ 44 px** on interactive controls (matches iOS HIG
    / Android 48 dp guidance). Smaller is acceptable on `md+` if a
    larger pointer-friendly equivalent is also reachable.
  - **Tables and data-dense surfaces** must handle narrow viewports:
    horizontal scroll inside the surface OR a card/list fallback at
    `sm` — the owning feature picks what reads better for its data.
    Tables should never force `body` to scroll horizontally.
  - **Header / navigation collapse rules** — non-essential elements
    (e.g. "Hello, *firstname*" greeting, breadcrumbs) get
    `hidden sm:inline` / `hidden md:flex` so the icon row stays
    uncrowded on narrow screens. Don't ship a hamburger pattern until
    a screen genuinely needs it.
  - **Per-batch responsibility** — at the close of each batch, the
    handoff note records that the touched feature was checked at
    `sm` (375 px), `md` (768 px), and a desktop viewport. Batch 9
    re-verifies the contract project-wide as part of its audit pass.
  - **Effort tiers by surface density.** The *check* is always per
    batch; the *implementation work* scales with what the feature
    actually contains:
    - **Form / list / chip surfaces** (auth pages, profile, tags,
      beneficiaries, settings): usually a 5-minute viewport smoke
      test — open at 375 px and desktop, click around, fix anything
      visibly broken. Often nothing needs to change; record the
      check in the handoff and move on.
    - **Table, grid, multi-step, and dense surfaces** (transactions
      list, statement upload, taxation bills, budget grids,
      Dashboard, statement-parse review tables): require deliberate
      responsive design *upfront* — pick the degradation strategy
      (horizontal-scroll-inside-card, card-stack, column-hide) before
      writing the markup, not after. Tables don't degrade naturally;
      retrofitting is painful.
    - The handoff note should be honest about which tier the
      surface fell into and what (if anything) needed work.
- **Modals over secondary routes for create/edit sub-flows.**
  `shared/components/Modal.tsx` (added in the Post-Batch-6 commit)
  is the **preferred surface** for any flow that creates or edits a
  sub-entity from within a parent context — adding a beneficiary
  while filling a categorization rule, editing a budget limit from
  the budgets overview, etc. Reasons: the parent's in-flight form
  state survives the round trip; no cross-window juggling; mobile
  reflows to a bottom-sheet automatically; keyboard-trap-free
  Escape + click-outside close. Consumer pattern: caller component
  owns the open/close state and a typed `onCreated` /
  `onSaved` callback; the dialog wraps the shared form-fields
  component + a Save/Cancel footer.
  - **Auth on the landing page** is a planned application of this
    pattern: `/` (HomePage) gets primary CTAs that open Login /
    Register as modals reusing the existing form components from
    `features/auth/pages/`. **Keep `/login` and `/register` as
    routes alongside the modal entry points** — they remain the
    canonical surface for deep links (password-reset emails →
    "Sign in to continue"), browser password-manager detection,
    SEO/indexing controls, and back-button semantics. The modal is
    an additional entry path, not a replacement. Concretely: extract
    the form bodies from `LoginPage` / `RegisterPage` into reusable
    `<LoginForm>` / `<RegisterForm>` components, then mount them
    inside both the route page and a `<Modal>` on Home. Slated for
    a Post-Batch-9 polish session.
  - **Don't use a modal for primary-content surfaces** (dashboards,
    list views, detail pages). Modals are for *secondary, focused
    actions* — anything that would also work as "open in a new tab"
    belongs on a route, not in a modal.
- **Loading and empty states** are first-class. Skeletons for any list
  fetch > 200 ms (per §8); thoughtful empty states with a clear next
  action (not just "No data").
- **Accessibility is part of polish**, not a separate concern: visible
  focus, ARIA where semantic HTML doesn't suffice, color contrast
  passing WCAG AA.

**Anti-patterns to avoid:**

- Generic Bootstrap-era blue buttons; flat untreated forms; tables with
  zero whitespace; harsh saturated colors; modals that fill the entire
  viewport on desktop; UI that looks the same in light and dark mode
  because dark mode wasn't considered.

**Pragmatism — don't redesign blindly:** if a screen already works well
visually and just needs to migrate from plain CSS to Tailwind, do exactly
that. Reserve substantial redesign effort for screens that are visibly
weak today (likely candidates: Dashboard, Transactions list, Budget
overview, Taxation bills view).

**When a redesign decision is non-trivial** (e.g. picking the accent
color, choosing between two layout structures for a complex screen),
pause and surface options — this is exactly the kind of taste decision
that benefits from user input rather than autonomous choice.

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

| #   | Decision           | Choice                                                                                                                                            | Future option                                                                                                                                   |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Test file location | Co-located `*.test.tsx`; `src/test/` for MSW handlers and shared infra only                                                                       | —                                                                                                                                               |
| 2   | Lint + format      | ESLint flat config + Prettier + plugins (`react`, `react-hooks`, `jsx-a11y`, `import` with `no-restricted-paths`) + `prettier-plugin-tailwindcss` | Revisit Biome in ~12 months once `react-hooks/exhaustive-deps` and `jsx-a11y` equivalents land                                                  |
| 3   | Type system        | **TypeScript strict**, `noUncheckedIndexedAccess`, `allowJs` during migration; OpenAPI → `src/shared/types/api.ts` via `openapi-typescript`       | —                                                                                                                                               |
| 4a  | Server state       | **TanStack Query v5**                                                                                                                             | —                                                                                                                                               |
| 4b  | Client state       | **Zustand**, one store per domain, `persist` middleware for auth                                                                                  | —                                                                                                                                               |
| 5   | Forms + validation | **react-hook-form + Zod**; Zod schemas double as TS request-body types                                                                            | —                                                                                                                                               |
| 6   | Styling            | **Tailwind CSS v4** + `@layer components` for shared patterns; class sorting via Prettier plugin                                                  | Revisit **vanilla-extract** if/when the project scales to need typed, zero-runtime styles with formal theming                                   |
| 7   | Backend mocking    | **MSW**, handlers under `src/test/handlers/<feature>.ts`; `vi.mock(apiClient)` reserved for transport-level tests                                 | —                                                                                                                                               |
| 8   | Routing            | `createBrowserRouter` + per-feature `RouteObject[]` + `protectedRoutes()` helper; per-route `lazy` for code-splitting                             | Migration to **TanStack Router** is a future adoption, not part of this refactor                                                                |
| 9   | Auth state         | `useAuthStore` (Zustand + `persist`) replaces `AuthContext`; selector-based subscriptions                                                         | New stores added only when a concrete cross-page client-state need exists                                                                       |
| 10  | Error boundaries   | Global ErrorBoundary at app shell + per-feature `errorElement` on each `RouteObject`                                                              | Watch **Statement Upload** and **Weekly Tax generation** for crash frequency; add finer sub-route boundaries inside those pages if errors recur |
| 11  | Bundle budget      | ≤ 120 KB gzipped first-paint JS, ≤ 80 KB per per-feature lazy chunk, ≤ 15 KB CSS; `size-limit` CI gate wired in Batch 9                           | —                                                                                                                                               |
