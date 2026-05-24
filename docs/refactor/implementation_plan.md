# Frontend Refactoring Plan

> [!NOTE]
> **Planning resolved 2026-05-24.** Modelled on
> [`backend/docs/refactor/implementation_plan.md`](../../../backend/docs/refactor/implementation_plan.md).
> Every `TODO(planning)` from the original scaffold is now locked — see the
> [decision table in CONTRIBUTING.md §10](../../CONTRIBUTING.md#-10-architectural-decisions-resolved--planning-session-2026-05-24).
> Batch 0 is fully specified below; Batches 1–9 will be refined in their own
> sessions.

---

## Goal

Reshape `frontend/src/` from a "by-technical-layer" tree
(`pages/`, `components/`, `state/`, `utils/`) into a **feature-based**
layout under `src/features/<feature>/` that mirrors `backend/app/modules/`.
Along the way, resolve the cross-cutting decisions captured in
[`CONTRIBUTING.md` §10](../../CONTRIBUTING.md): state library, form library,
styling, linting, TypeScript.

**No new product features in this refactor.** Compatibility with the
backend's API surface stays unchanged; the changes are structural.

**Visual upgrade rides along.** The refactor is also the opportunity to
shift the app's visual surface to a modern, sleek, premium look — see
[CONTRIBUTING.md §6 "Visual design language"](../../CONTRIBUTING.md#visual-design-language)
for the target language and operating principle. Every component touched
during a feature batch gets its visuals upgraded in the same pass; do not
re-skin the pre-refactor plain look behind Tailwind utilities.

---

## User Review Required & Design Decisions

> [!IMPORTANT]
> **1. Tooling baseline (Batch 0)** — locked. The full toolchain is in
> [CONTRIBUTING.md §3](../../CONTRIBUTING.md#-3-tooling--workflow) and §10.
> Summary: ESLint flat + Prettier, **TypeScript strict** (migrate per-feature
> as each batch moves files), **TanStack Query v5** for server state,
> **Zustand** for client state (first store: `useAuthStore`),
> **react-hook-form + Zod** for forms, **Tailwind v4** for styling,
> **MSW** for backend mocking in tests, `createBrowserRouter` + per-feature
> `RouteObject[]` for routing, **`size-limit`** for the bundle gate.

> [!IMPORTANT]
> **2. Feature naming follows the backend**
> Feature folders use the same vocabulary the backend uses (`auth`, `users`,
> `metadata`, `tags`, `beneficiaries`, `transactions` + `statement_upload/`,
> `categorization`, `taxation`, `budgets`). Anyone working across the stack
> can `cd backend/app/modules/<X>` and `cd frontend/src/features/<X>` and see
> the matching pair.

> [!IMPORTANT]
> **3. Per-batch frontend tests must stay green**
> `npm test` is the gate. Each batch ends with all existing test files
> passing under their new locations.

> [!WARNING]
> **No backend-shape changes in this refactor.**
> If a frontend change requires touching `/api/...` shapes, defer it to a
> backend follow-up rather than coupling the two refactors.

---

## Proposed Refactoring Batches

```mermaid
graph TD
    A[Batch 0: Tooling & Baseline] --> B[Batch 1: shared/ + app shell]
    B --> C[Batch 2: auth feature]
    C --> D[Batch 3: users + metadata]
    D --> E[Batch 4: tags + beneficiaries]
    E --> F[Batch 5: transactions + statement_upload]
    F --> G[Batch 6: categorization]
    G --> H[Batch 7: taxation]
    H --> I[Batch 8: budgets]
    I --> J[Batch 9: cleanup + docs + perf]
```

### Batch 0 — Tooling & Baseline

Order matters: each step assumes the prior one is in place. Use WIP commits
locally between steps as rollback checkpoints, but **do not push them** —
at the end of the batch, soft-reset and condense to a single
`Frontend Batch 0: tooling baseline (…)` commit before pushing. The
refactor branch carries one commit per batch, not one per step (bisect
granularity is batch-level — see [`.scratch/task-frontend.md`](../../../.scratch/task-frontend.md)
"Workflow" for the soft-reset recipe).

1. **ESLint + Prettier.** Install: `eslint@^9`, `@eslint/js@^9`,
   `eslint-plugin-react`, `eslint-plugin-react-hooks`,
   `eslint-plugin-jsx-a11y`, `eslint-plugin-import`,
   `eslint-config-prettier`, `prettier`, `prettier-plugin-tailwindcss` (used
   from step 7 onwards but install now to avoid a follow-up config bump).
   **ESLint pinned to v9 deliberately:** ESLint 10 released in early 2026
   but `eslint-plugin-import@2.32.0` and several other plugins still declare
   their peer range as `^9` only — installing `eslint@*` resolves to v10 and
   produces `ERESOLVE` errors. v9 still ships flat config (the planning
   decision); we revisit v10 once the plugin ecosystem catches up.
   Flat config in `eslint.config.js`. `import/no-restricted-paths` rule
   pre-wired with the eventual `features → shared` boundary. Run
   `npm run format -- --write` over the existing tree as a single commit so
   future batches' diffs stay clean.
2. **TypeScript.** Install: `typescript@~5.9` (pinned because
   `openapi-typescript@7.x` does not yet support TS 6.x), `@types/react@^18`,
   `@types/react-dom@^18` (**pinned to v18 to match the React 18.3 runtime
   — installing `@types/react@latest` resolves to v19 and produces
   load-bearing type errors against React 18 code, including the
   `useRef<T>()` signature change and the removal of the implicit `children`
   prop**). `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`,
   `allowJs`, `jsx: "react-jsx"`. Convert `src/main.jsx` → `src/main.tsx`
   and `src/App.jsx` → `src/App.tsx` as the smoke proof. Add
   `vite-tsconfig-paths` if path aliases (`@/...`) are wanted. Strategy for
   batches 1–8: "convert each file as its feature batch moves it" — no
   second sweep.
3. **OpenAPI types.** Install: `openapi-typescript`. `npm script gen:api` →
   `openapi-typescript http://localhost:4000/openapi.json -o src/shared/types/api.ts`.
   Not run in CI; regenerated on demand. Commit the first generation so types
   are available before Batch 1.
4. **TanStack Query.** Install: `@tanstack/react-query` +
   `@tanstack/react-query-devtools`. Wire `QueryClientProvider` in
   `src/App.tsx` (moves to `src/app/providers.tsx` in Batch 1). Sensible
   defaults: `staleTime: 30_000`, `refetchOnWindowFocus: false`, retry: 1.
   Smoke test: a `useQuery` against a stub endpoint in MSW (step 8).
5. **Zustand.** Install: `zustand`. Skeleton `src/state/auth.store.ts` (no
   real login wiring yet; just `user: null` + a `set` action). Moves to
   `src/features/auth/state/` in Batch 2. Smoke test asserts the store
   exists and updates.
6. **react-hook-form + Zod.** Install: `react-hook-form`, `zod`,
   `@hookform/resolvers`. No code yet — confirmed by `tsc --noEmit`.
7. **Tailwind CSS v4.** Install: `tailwindcss@4`, `@tailwindcss/vite`. Add
   the Vite plugin in `vite.config.ts`. Create `src/index.css` with
   `@import "tailwindcss";` and an empty `@layer components`. Replace one
   existing button's CSS with Tailwind utilities as smoke proof. Configure
   `prettier-plugin-tailwindcss` in `.prettierrc`.
8. **MSW.** Install: `msw`. Create `src/test/server.ts`,
   `src/test/handlers/health.ts` (one stub endpoint),
   `src/setupTests.ts` updated to start/stop the server with
   `beforeAll`/`afterAll` and `resetHandlers` between tests. Convert the
   existing `vi.mock(apiClient)` tests **only if** trivial; defer the bulk
   migration to each feature's batch.
9. **size-limit.** Install: `size-limit`, `@size-limit/preset-app`.
   `.size-limit.json` with two entries: initial bundle ≤ 120 KB gz,
   per-feature lazy chunk ≤ 80 KB gz. **Not yet a CI gate** — Batch 9 wires
   that. Record current numbers in `docs/performance.md`.
10. **Docs skeleton.** Create `frontend/docs/{architecture,testing,performance}.md`
    and an empty `frontend/docs/modules/` folder. `architecture.md` gets a
    one-paragraph stub pointing at CONTRIBUTING.md.
11. **Gate.** `npm run lint`, `npm test`, `npm run build`, `npm run size`
    all green. Commit the final state as
    `Frontend Batch 0: tooling baseline (ESLint, TS, RQ, Zustand, RHF+Zod, Tailwind, MSW, size-limit)`.

### Batch 1 — `shared/` + app shell

- [ ] Create `src/shared/{api,components,hooks,utils,types}/`. (`types/api.ts`
      already exists from Batch 0 step 3.)
- [ ] Move + convert `src/utils/{apiClient,dateUtils,validation}.js` →
      `src/shared/{api,utils}/*.ts`. Update every import.
- [ ] Move + convert `src/components/{ErrorBoundary,ProtectedRoute,PasswordRequirements}.jsx`
      → `src/shared/components/*.tsx`.
- [ ] Carve `src/app/` out of `src/App.tsx`: `App.tsx` (root layout),
      `routes.tsx` (`createBrowserRouter` composer — starts with an empty
      array, populated by feature batches), `providers.tsx` (composed:
      `QueryClientProvider` + global `<ErrorBoundary>` + Suspense fallback +
      `useAuthStore.hydrate()` call on mount).
- [ ] Add a `protectedRoutes(routes)` helper in `src/app/routeHelpers.ts`
      that wraps each `RouteObject` so its `element` is gated by
      `<ProtectedRoute>` — used by Batches 3–8 when their routes are added.
- [ ] **User-preferences plumbing (currency + timezone)** — see
      [CONTRIBUTING.md §5 "User preferences contract"](../../CONTRIBUTING.md#user-preferences-contract-currency--timezone)
      for the full spec.
      - `src/shared/state/preferences.store.ts` — `usePreferencesStore`
        (Zustand + `persist`), shape
        `{currency: string; country: string | null; timezone: string;
        setPreferences(p): void; reset(): void;}`. Defaults: `currency:
        'USD'`, `country: null`, `timezone: 'UTC'`. Lives in `shared/`
        because `apiClient.ts` reads from it.
      - `src/shared/api/apiClient.ts` — extend the existing header build
        to also inject `x-user-currency` and `x-user-timezone` from the
        store on every request (read via
        `usePreferencesStore.getState()` — outside React render path).
      - `src/shared/utils/currency.ts` — new module with
        `formatMoney(amount, code, symbol)` returning
        `${symbol}${formatted}` when symbol present, `${code}
        ${formatted}` when null. Includes `parseMoney` if any input form
        needs the inverse (likely not in Batch 1).
      - `src/shared/utils/dateUtils.ts` — extend with tz-aware helpers:
        `formatDate(iso, tz, opts)`, `formatDateTime(iso, tz, opts)`,
        `todayInUserTz(tz)` (returns local-tz `YYYY-MM-DD` for
        date-input defaults), `localToUtcIso(localDateString, tz)`
        (form-submit inverse).
      - No real prefs flowing yet — the store always returns defaults
        until Batch 2 wires the login flow. Smoke test asserts the two
        headers appear on a sample `apiFetch` call when store values
        are non-default.
- [ ] **Theme infrastructure (dark / light / system) + header toggle:** - `src/shared/state/theme.store.ts` — `useThemeStore` (Zustand +
      `persist` middleware) with modes `'light' | 'dark' | 'system'`,
      default `'system'`. Subscribes to `prefers-color-scheme` for the
      system mode. - `src/shared/components/ThemeToggle.tsx` — small icon button
      (sun / moon / monitor) cycling through the three modes. Mounted
      top-right of the app header in `src/app/App.tsx`. - Tailwind v4 class-based dark strategy in `src/index.css`:
      `@variant dark (&:where(.dark, .dark *));`. - `index.html` — synchronous inline script (~10 lines) that reads
      the persisted theme from `localStorage` and sets
      `<html class="dark">` _before_ React renders. Prevents FOUC flash
      on initial load. - `src/app/providers.tsx` — `useThemeStore.hydrate()` and effect
      that mirrors store state to the `<html>` class on every change. - Install `lucide-react` (~3 KB tree-shaken) for the icons. Not a
      §10-locked decision; added as the conventional icon dep. - Settings-page placement of the toggle is added later in Batch 3
      when the users feature lands.
- [ ] `npm test` green; no functional change to existing features.

### Batch 2 — `auth` feature

- [ ] Move + convert `src/pages/user/{Login,Register}.tsx` + tests →
      `src/features/auth/pages/`.
- [ ] Move + convert `src/state/AuthContext.jsx` → `src/features/auth/state/auth.store.ts`.
      Replace Context API with the Zustand `useAuthStore` skeleton from
      Batch 0; add real `login`/`logout`/`refresh` actions backed by the
      `api/mutations.ts` hooks. Add `persist` middleware for the access
      token. Delete `AuthContext.jsx`.
- [ ] Move every recovery-related page → `src/features/auth/recovery/`.
- [ ] Extract `src/features/auth/api/`: `schemas.ts` (Zod for login /
      register / recovery request bodies), `queries.ts` (`useCurrentUserQuery`),
      `mutations.ts` (`useLoginMutation`, `useRegisterMutation`, etc.),
      `keys.ts`. All inline fetch sites migrate to these hooks.
- [ ] Rebuild forms with `react-hook-form` + `zodResolver` against the same
      schemas.
- [ ] `src/features/auth/auth.routes.tsx` exports a `RouteObject[]` with a
      per-route `errorElement` (`<AuthErrorFallback />`). Consumed by
      `src/app/routes.tsx`.
- [ ] MSW handlers under `src/test/handlers/auth.ts`. Drop the per-test
      `vi.mock(apiClient)` calls.
- [ ] **Register form: timezone field + smarter locale defaulting.**
      - **Replace** the existing 6-country hardcoded locale switch
        (`if region === 'IN'… else if 'US'…`) with `Intl.DisplayNames`:
        `new Intl.DisplayNames(['en'], { type: 'region' }).of(region)`
        returns the country's English name → match against the
        `/api/metadata/countries` list. Covers all ~250 ISO regions,
        zero hardcoded mapping. No IP geolocation (privacy/dependency
        cost not worth marginal accuracy on a register form).
      - **New `<TimezoneSelect />` component** in
        `src/features/metadata/components/TimezoneSelect.tsx`. Owned by
        the metadata feature (Batch 3 reuses it on Profile), built
        early in Batch 2 because Register needs it. Behavior driven by
        the selected country's timezone cardinality:
        - **Country has one timezone** → render read-only field with
          that tz; "Use a different timezone" expand-link reveals the
          full-IANA fallback dropdown.
        - **Country has multiple timezones** → render dropdown of *that
          country's* timezones, defaulted to the backend's primary
          (`country.timezone` from the metadata API). Same "Use a
          different timezone" expand-link for users physically located
          outside their country of residence.
        - **Country unknown / "Rather not say"** → full IANA dropdown
          via `Intl.supportedValuesOf('timeZone')`, defaulted to
          browser's `Intl.DateTimeFormat().resolvedOptions().timeZone`.
      - **Country→timezones data source:** install
        `countries-and-timezones` (~30 KB gz tree-shaken). Lazy-loads
        with the auth chunk; first-paint not affected. Wrapped behind
        a tiny `src/shared/utils/countryTimezones.ts` so the swap to a
        backend-sourced list (when the queued follow-up lands —
        see "Backend follow-ups" below) is one-file.
      - **Register payload** now includes `timezone: string`. Backend
        accepts it via the existing profile/preferences flow (timezone
        is currently transient via `UserPreferencesMiddleware`; persist
        on the profile if the backend follow-up adds the column).
- [ ] **Hydrate `usePreferencesStore` from `/api/users/preferences`:**
      - On successful login: `useLoginMutation.onSuccess` →
        `GET /api/users/preferences` → `usePreferencesStore.setPreferences(...)`.
      - On token refresh (`apiClient.ts` refresh path): re-fetch
        preferences (covers profile-changed-on-another-device case).
      - On logout: `usePreferencesStore.reset()` back to USD/UTC defaults.
      - MSW handler at `src/test/handlers/users.ts` (placeholder for
        Batch 3's full users handler) returns a sample preferences
        payload for the login smoke test.
- [ ] `npm test` green.

### Batch 3 — `users` + `metadata` features

- [ ] Move `src/pages/user/ProfilePage.jsx` + tests → `src/features/users/pages/`.
- [ ] If the registration form's country/currency dropdowns currently live in
      `Register.jsx`, factor them out into `src/features/metadata/components/`
      (CountrySelect, CurrencySelect — both consume `/api/metadata/*`).
- [ ] **Currency dropdown shows `${code} (${symbol})`** (fallback to just
      `${code}` when `symbol` is null). Lives in
      `features/metadata/components/CurrencySelect.tsx`.
- [ ] **`CountrySelect` auto-populates timezone** from the selected
      country's metadata `timezone` field — saving the profile with a
      new country updates both `country` and the active `timezone`. Allow
      user to override timezone explicitly via a separate dropdown if
      country's default doesn't match (e.g. user in a different tz than
      their nationality).
- [ ] **On profile save**: after the PATCH/PUT succeeds, re-fetch
      `/api/users/preferences` and call
      `usePreferencesStore.setPreferences(...)` so all open tabs see the
      new currency/tz immediately (also re-renders every component
      using `formatMoney`/`formatDate`).
- [ ] **`features/users/api/queries.ts`** owns the `useUserPreferencesQuery`
      hook (used by Batch 2's login flow and this batch's profile page;
      both invalidate it on mutation).
- [ ] `npm test` green; write `docs/modules/users.md` and
      `docs/modules/metadata.md`.

### Batch 4 — `tags` + `beneficiaries` features

- [ ] Move `src/pages/user/settings/CategoriesTab.jsx` (tags UI) →
      `src/features/tags/`.
- [ ] Move `src/pages/beneficiaries/*` → `src/features/beneficiaries/`.
- [ ] Add `src/features/<feature>/api/` for each.
- [ ] `npm test` green.

### Batch 5 — `transactions` + `statement_upload`

- [ ] Move `src/pages/transactions/*` → `src/features/transactions/pages/`.
- [ ] Statement-upload UI nests as `src/features/transactions/statement_upload/`
      to mirror the backend.
- [ ] Add `src/features/transactions/api/` (list / get / create / update /
      delete + statement-upload pipeline).
- [ ] `npm test` green.

### Batch 6 — `categorization`

- [ ] Move `src/pages/user/settings/CategorizationRulesTab.jsx` →
      `src/features/categorization/`.
- [ ] `npm test` green.

### Batch 7 — `taxation`

- [ ] Move `src/pages/tax/*` → `src/features/taxation/pages/`.
- [ ] Surface taxation rules + consumption-tax bills under a single feature
      route group.
- [ ] `npm test` green.

### Batch 8 — `budgets`

- [ ] Move `src/pages/budgets/*` → `src/features/budgets/`.
- [ ] `npm test` green.

### Batch 9 — Cleanup, Docs, Performance

- [ ] Delete the now-empty `src/{pages,components,state,utils}/` directories.
- [ ] Verify zero remaining imports from the old paths (ESLint
      `import/no-restricted-paths` should already enforce this, but grep
      `src/(pages|components|state|utils)/` to be safe).
- [ ] Final docs pass — every `docs/modules/<feature>.md` page mirrors the
      backend's per-module page in shape (Purpose / Pages / Components /
      Hooks / API / Tests).
- [ ] Promote `size-limit` from local-only to a CI gate. Fail the build if
      the initial bundle exceeds 120 KB gz or any per-feature lazy chunk
      exceeds 80 KB gz.
- [ ] Lighthouse audit; record numbers in `docs/performance.md`.
- [ ] Wire `vitest --coverage` with the §7 targets (80% critical-path,
      60% elsewhere). Record in `docs/testing.md`.
- [ ] **User-preferences audit** — grep-based verification that the
      contract from
      [CONTRIBUTING.md §5 "User preferences contract"](../../CONTRIBUTING.md#user-preferences-contract-currency--timezone)
      holds across `src/features/`:
      ```bash
      # zero non-helper hits expected in src/features/
      git grep -nE '\.toLocaleString\(' src/features/
      git grep -nE 'new Date\(' src/features/ | grep -v dateUtils
      git grep -nE 'toISOString\(\)\.split' src/features/
      ```
      Any hits get refactored to use `shared/utils/currency.ts` or
      `shared/utils/dateUtils.ts` before sign-off. Add a lint rule via
      `no-restricted-syntax` if drift is observed.
- [ ] Monitor risky surfaces in production / dev usage: **Statement Upload**
      (file parsing, multi-step async) and **Weekly Tax generation**
      (background work, cross-module data). If either crashes more than
      occasionally, add a sub-route `<ErrorBoundary>` inside the page rather
      than relying only on the per-feature `errorElement`.
- [ ] Run `npm test` + `npm run build` + full app smoke test against a live
      backend before signing off.

---

## Backend follow-ups (queued — out of scope for this refactor)

These are backend changes the frontend would benefit from. None block
any batch in this plan; the frontend works around each gap as noted
below. Track these as separate backend tasks after the refactor merges.

- **`/api/metadata/countries` → return `timezones: List[str]` per
  country** (currently returns singular `timezone`). The frontend
  workaround for Batch 2 bundles the `countries-and-timezones` npm
  package (~30 KB gz) and wraps it behind
  `src/shared/utils/countryTimezones.ts` so swap-to-backend-source is
  one file. Once the backend adds the list, drop the package and read
  from the API. Backend impact: schema + seed data extension; no
  breaking change (keep `timezone` as the singular default alongside
  the list).
- **Profile schema: persist `timezone` column** (currently transient
  via `UserPreferencesMiddleware` only — derived from the country's
  default, or `UTC` if absent header). If a user explicitly overrides
  their timezone via Profile, that choice is lost across logins.
  Adding a `timezone` column on `UserProfile` lets the override
  persist. Frontend already sends `x-user-timezone` on every request
  (per the §5 contract) and includes `timezone` in the Register
  payload from Batch 2; backend just needs to store + return it.

---

## Verification Plan

```bash
cd frontend
npm test                                          # vitest run (gate per batch)
npm run build                                     # bundle must build
npx vitest run src/features/<feature>/<file>      # focused run during batch
```

Manual smoke-test loop (start backend + frontend, click through each
feature) is the closing gate for Batch 9.

---

## Frozen baseline

Before starting Batch 0, commit the current frontend on its own commit:

```text
Frontend: keep parity with backend Batches 1-7 (async + metadata symbol)
```

That commit is the **rollback point** if the refactor goes sideways.
