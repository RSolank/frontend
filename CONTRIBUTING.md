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

### Modal pattern (CRUD-first surfaces)

Locked in Batch 6.5 (planned 2026-05-26). **Modal-first CRUD is the
default for content features** (transactions, beneficiaries, tags,
categorization rules, taxation rules, budget limits). Add / edit /
view / delete-confirm flows open as modals over the list page rather
than navigating to a dedicated page. Auth (Login / Register / Recovery)
is **hybrid** — full pages preserved for deep-links and password
manager autofill, modal flow offered from Home as a convenience layer.

**Why modals over pages for CRUD:**

- **Context preservation.** Users see the list behind the modal —
  they don't lose their place.
- **Faster perceived flow.** No route transition; modal open is
  instantaneous, route transitions trigger a re-mount of the list
  and refetch.
- **Mobile-friendly.** A full-viewport modal on narrow viewports
  reads identically to a page; on desktop the side-by-side context
  is a clear win.

**Implementation rules:**

- All modals use `src/shared/components/Modal.tsx` (wraps Radix UI's
  Dialog). Never roll a custom modal — accessibility correctness
  (focus trap, escape-key, ARIA dialog semantics, scroll lock) is too
  error-prone to redo per feature.
- Sizing variants: `sm` (~400 px, confirmation dialogs), `md` (~600 px,
  most CRUD forms), `lg` (~800 px, dense forms or detail views),
  `xl` (~1024 px, statement upload preview). Stick to the four; don't
  invent new sizes.
- **URL-state sync for shareable modals.** Modals that represent a
  primary user intent (add-transaction, edit-budget) sync state to
  the URL via `useModal({ urlKey: 'add' })` so `/transactions?add=true`
  reopens the modal on reload and is shareable. Modals that are
  ephemeral (delete confirmation, error details) don't need URL sync.
- **Forms inside modals use react-hook-form normally** — Zod schema +
  resolver, same pattern as page forms. The form component should be
  extractable: a single `<XyzForm />` mounted in both a page wrapper
  and a modal wrapper (no form-state duplication).
- **Modal close confirmations** when the form is dirty — built into
  `Modal.tsx` via a `confirmOnDirty` prop; never let users lose typed
  input to a stray backdrop click.

**When NOT to use a modal:**

- **Auth flows on first visit** — full pages are friendlier to
  password managers and screen readers (hybrid auth keeps both).
- **Multi-step wizards** beyond ~3 steps — promote to a page with
  step indicators.
- **Long-form editing** where the user needs persistent navigation
  (rare in this app).

### Searchable list with inline create

Locked in the 2026-05-26 Batch 6.5 follow-up. **When a form field
asks the user to pick from a list AND the user can extend that list,
the picker uses the SearchableList pattern.** Use it for beneficiary
pickers, tag pickers, categorization-rule beneficiary + tag pickers,
and any future surface meeting both conditions.

**Apply only when both invariants hold:**

1. There is a finite list of candidate values to choose from.
2. The user is allowed to *add* new values to that same list.

If a field only searches a fixed catalog (country / currency /
timezone — the user can pick, not add), use a plain `<select>` or
typeahead instead. This pattern is reserved for the pick-or-create
case.

**Anchor invariants of the pattern:**

- **Search input.** Single text input, `placeholder="Search <plural>..."`
  (e.g. `Search tags...`, `Search beneficiary...`). Filters the
  dropdown as the user types.
- **Dropdown opens on focus**, closes shortly after blur (use a
  ~200 ms setTimeout so click handlers on options can fire before
  the dropdown unmounts).
- **`+ Add new <singular>` is the FIRST item** in the dropdown
  (sticky-top, visually distinct from the list options). It must
  **always be visible** — including when search returns zero
  matches. The user should never be stuck because what they want
  to add doesn't exist yet.
- **Empty / no-match state** appears below the Add CTA, not in
  place of it: `"No matches"`.
- **Clicking Add** opens the corresponding `<XyzFormDialog />`
  (modal pattern above). On save, the parent **refreshes the
  source list** and, for single-select, **auto-selects** the new
  entry; for multi-select, **auto-appends** it.
- **Selection-state rendering depends on cardinality:**
  - **Single-select:** the chosen value lives *inside* the search
    input — pick replaces the search text with the value's label;
    the dropdown closes; the parent is responsible for caching the
    chosen id alongside the visible name. No chip rail.
    Reference: `BeneficiarySearch`.
  - **Multi-select:** every pick appends a chip to a rail rendered
    *below* the input. Chips carry a `×` remove button. Already-
    selected ids are filtered out of the dropdown so the same
    value can't be re-picked.
    Reference: `TagSelector`, categorization-rules tag picker.
  - **Feature-specific chip enrichment** (e.g. "Primary" badge +
    "Set Primary" buttons on categorization-rule tag chips, alias
    bracket display on beneficiary chips) is allowed on top of the
    multi-select base. It's a *layer over* the pattern, not a
    deviation from it.
- **Type-then-create flow:** if the user types a name not in the
  list, the Add CTA stays at top of the dropdown. Optionally
  pre-fill the dialog's Name with the current search text so the
  user doesn't retype (see `BeneficiaryFormDialog` `initialName`).

**Reference implementations (live in the repo):**

- `features/transactions/components/BeneficiarySearch.tsx` — single-
  select, opens `BeneficiaryFormDialog`.
- `features/transactions/components/TagSelector.tsx` — multi-select,
  opens `TagFormDialog`.
- `features/categorization/pages/CategorizationRulesPage.tsx`
  inline tag picker — multi-select with Primary semantics, opens
  `TagFormDialog`.

**Reason to extract a shared component later:** when a fourth
surface adopts this pattern with the same single/multi shape, fold
into `shared/components/SearchableList.tsx`. Until then the
copy-paste keeps each surface free to apply feature-specific chip
rendering (Primary tag, alias bracket display) without a shared-API
re-design.

### Searchable dropdowns (when required)

Locked 2026-05-29 during the Batch 9.6 review. Complements the
"Searchable list with inline create" pattern above; this convention
covers the **pick-only** case (no `+ Add new` CTA — the candidate
set is closed).

**A dropdown / selector MUST be searchable (typeahead-narrowed)
when ANY of these hold:**

1. **Size:** > 15 candidate items.
2. **Nature:** data-driven (backed by a user-extendable or
   backend-populated list that grows over time).
3. **No inherent scan order:** alphabetical-by-name across many
   items where visual scan past ~15 is slow.

**Plain `<select>` is correct when ALL of these hold:**

- ≤ 15 items, AND
- inherent semantic / chronological order (months, years, priority
  levels), AND
- native browser type-letter behavior (jumps to first match by
  initial letter) does the job.

**Shared component:** `shared/components/SearchableSelect.tsx`.
Single-select typeahead, ARIA combobox + listbox + option +
`aria-activedescendant`. Keyboard nav: ↑/↓ moves highlight, Enter
selects, Esc closes; hover updates highlight so click + keyboard
don't conflict. The component composes a clear button + chevron
toggle; the empty-value option (e.g. "All tags") is just an
ordinary entry in `options[]`.

**Decision matrix for current pickers:**

| Surface | Convention | Reason |
|---|---|---|
| Beneficiary picker (Add Tx, Categorization Rules) | `SearchableList` (pick-or-create) | Data-driven, user can add |
| Tag picker on Add Tx | `SearchableList` (pick-or-create, multi) | Data-driven, user can add |
| Tag dropdown in Filter Sidebar | `SearchableSelect` | Data-driven, often > 15 |
| Merchant search bar (Transactions filter row) | bespoke (per-feature `MerchantSearchBar`) | Filter-row chrome, not a sidebar dropdown |
| Country picker (Register, Profile) | `SearchableSelect` | 250 items |
| Currency picker (Profile, Preferences) | `SearchableSelect` | 170 items |
| Timezone picker (Register, Profile) | bespoke `TimezoneSelect` (country-narrowing) | Specialised filter cascade |
| Month dropdown (Transactions filter) | plain `<select>` | Sequential, 25 items, native jump works |
| Type filter (debit/credit/all) | pill toggle | 3 items — toggle, not dropdown |
| Sort field / direction (Filter Sidebar) | plain `<select>` | ≤ 4 items, fixed |
| Date format / number format pickers | plain `<select>` | ≤ 10 items, semantic groups |

**Anti-patterns to avoid:**

- Wrapping a small fixed list (e.g. debit/credit/all) in a
  searchable component — adds chrome for no benefit; use a pill
  toggle instead.
- Using `<select>` for a 200-item list because "it's just an
  internal screen" — slow scrolling burns user time daily.
- Building per-feature typeahead components when
  `SearchableSelect` would compose. Reach for it first; only
  diverge when the pattern needs feature-specific chips /
  cascading filters that wouldn't fit a shared API.

**Sweep status:** the cross-feature enforcement pass that migrates
the remaining `CountrySelect` and `CurrencySelect` away from raw
`<select>` lives in **Batch 9.8** (see the refactor's
`task-frontend.md`).

### DetailModal (canonical view + edit surface)

Locked 2026-05-29 during the Batch 9.6 review; the in-modal
behaviour (form always rendered, no view/edit toggle) reaffirmed
in Batch 9.8. **Every CRUD-shaped feature exposes a single
canonical DetailModal as both the view-everything surface and the
edit surface.** Triggered by a row-level `⋯` (Lucide
`MoreHorizontal`) button on the right edge of each row/card.

**Why one modal, not two surfaces:** the alternative ("view page" +
separate "edit modal") triples the cognitive load — three click
paths, three render trees, three places to keep in sync. The
DetailModal collapses that to one surface where the form layout is
identical on open and after edits; per-field editability is the
field's own property (some fields render as readonly inputs, some
as live inputs).

**Anchor invariants:**

- **Trigger:** `⋯` icon button on the right edge of every row /
  card, sized 28–32 px to match the modal-header chrome
  (existing close X + Trash buttons).
- **URL state:** opens via `?edit=<id>` (existing pattern) or a
  feature-specific equivalent. Reloads land on the modal; deep
  links work.
- **Shows every relevant field** from the API response — even
  fields hidden in the row. The canonical example is the
  transaction `notes` field: not displayed on the row, fully
  visible + editable inside the modal. Anything the backend
  returns and the user might want to read goes here.
- **Per-field editability is the field's call.** Readonly fields
  render as `<input readOnly>` with muted styling
  (`cursor-not-allowed`, slate-50 background). HTML `disabled`
  swallows clicks, so `readOnly` + `onClick` is the workable
  shape — clicking a readonly field surfaces the
  `LockedFieldBanner` at the top of the modal explaining the
  lock and what IS editable. Editable fields render as live
  inputs. Source-gated rows (e.g. statement-imported
  transactions) gate edit-ability of individual fields, not the
  whole modal.
- **No view/edit mode toggle.** The form layout is identical
  regardless of dirty state — the transition between fresh-open
  and edited-dirty is invisible to the user. State is tracked
  internally for the dirty-confirm path; the only visible
  difference is the dismiss button text-swapping `Close` ↔
  `Cancel` and the Save button enabling once `isDirty`. Locked
  in Batch 9.8 after a brief view-first experiment was
  rejected for being too visually disruptive.
- **Title = entity identifier.** Beneficiary name, tag name,
  budget `tag_name` (e.g. `Edit budget — Groceries`), taxation
  rule `txn_type` capitalised, generated rule name. Add flow
  gets a `New <Feature>` prefix.
- **Footer convention.** Cancel/Close on the LEFT of the
  right-cluster (`justify-end gap-2`), Save on the RIGHT.
  Buttons size to content — no full-width buttons. Save is
  disabled until `isDirty`. The dismiss button's label
  text-swaps `Close` (clean) ↔ `Cancel` (dirty); both route
  through the same `confirmOnDirty` close path the Modal's X
  button uses.
- **One canonical component per feature** — `<FooFormDialog>`
  mounted in both row-click (edit) and list-header (add)
  contexts. The component branches its internal state on
  `editing != null`; no duplicate forms.
- **Delete lives in the modal header** per the existing
  "Modal-header destructive actions" convention (next section).
  When delete is unavailable (system rows, locked entities), the
  trash button is omitted, not disabled-with-tooltip.
- **System / locked rows still render `⋯`** so the entry-point
  is consistent. Inside, fields show as readonly and the trash
  is hidden.

**Reference implementations (live in the repo):**

- `features/transactions` — row `⋯` → `?edit=<id>` modal
  (Batch 9.6).
- `features/beneficiaries` — `BeneficiaryFormDialog` (full-field
  view+edit; add+edit branch on `editing` prop).
- `features/tags` — `TagFormDialog` (system tags render readonly).
- `features/budgets` — `BudgetFormDialog`.
- `features/categorization` — rule edit modal.
- `features/taxation` — `TaxationRuleFormDialog` for rules,
  `BillDetailDialog` for bills (read-only DetailModal — bills
  aren't edited, only viewed + paid).

**Sweep status:** the cross-feature enforcement pass that walks
every feature to ensure compliance lives in **Batch 9.8** (see
the refactor's `task-frontend.md`). New features after the
refactor merges adopt this convention from the start.

### Modal-header destructive actions (Remove-in-edit)

Locked in the 2026-05-27 Batch 8 follow-up review. **Every edit
modal that operates on a deletable entity surfaces an icon-only
Remove (Trash) button in the modal header, between the title block
and the close X.** Discoverable inside the edit context without
crowding the Cancel / Save footer.

**Anchor invariants:**

- **Render only in edit mode.** Add-mode (no `editing*` prop) hides
  the Remove button — there's nothing to remove yet.
- **Icon-only, sized 32×32.** Matches the close X chrome. Rose tint
  (`text-rose-600 dark:text-rose-400` with `hover:bg-rose-50 /
  dark:hover:bg-rose-950/40`) differentiates from the close X
  without dominating the header.
- **`title` + `aria-label` carry the text label** (e.g. "Remove
  beneficiary") — keyboard / screen-reader friendly; tooltip
  surfaces on hover.
- **Click opens an existing `<ConfirmDialog intent="danger">`** —
  never a direct delete. The page owns the confirm + mutation flow;
  the dialog stays focused on the form. Pattern: pass a
  `onRequestRemove` prop into the form dialog that the parent
  wires to `setConfirmDelete(entity)`.
- **Closes the edit modal on successful delete.** The page's
  `onConfirm` handler calls both the existing delete mutation AND
  `editModal.close()` so the user doesn't see a stale "not found"
  state after the row is gone.
- **Row-level Delete coexists.** List pages keep their per-row
  Delete buttons (BeneficiariesPage, TagsPage,
  CategorizationRulesPage, TransactionsPage). Two valid paths: row
  Delete for quick wipes; modal Trash for "while I'm editing, I
  want to delete instead". Mental model is consistent because the
  same `ConfirmDialog` fires in both cases.

**Where the convention applies:**

| Modal | Status | Notes |
|---|---|---|
| `BudgetFormDialog` | ✅ | Modal is the primary delete surface (no row-level delete on the cards). |
| `BeneficiaryFormDialog` | ✅ | Row + modal both available. |
| `TagFormDialog` | ✅ | Row + modal. Hidden when `editingTag` is a system tag (`created_by === null` or `=== SYSTEM_USER_ID`). |
| Transactions edit modal | ✅ | Gated on `editingTxn.source === 'manual'` — statement-imported txns can't be deleted (matches the row-dropdown gate). |
| `TaxationRuleFormDialog` | ❌ skip | Canonical 4 txn_types are system rows; "customize vs fall back to default" is the model, not "delete". |
| `BillDetailDialog`, `GenerateBillsDialog`, `MergeBeneficiariesDialog`, `AuthModal` | ❌ skip | View-only or action surfaces; nothing to delete. |

**Shared infra:** `shared/components/Modal.tsx` exposes a
`headerActions?: React.ReactNode` slot rendered between the title
block and the close X. Future modals that need a destructive header
action consume this slot — no new infra per surface.

**System / restricted entities:** when a class of entities can't
be deleted (system tags, locked rows, etc.), the parent omits
`onRequestRemove` in the form dialog and the icon doesn't render.
Avoids the disabled-button-with-tooltip pattern that suggests "you
might be able to do this later" — the action is genuinely absent.

### Row highlight on save

Locked in the 2026-05-26 Batch 6.5 follow-up review. **Every list
page that hosts add / edit modals briefly highlights the row that
was just created or saved.** The intent is to neutralize the
surprise of a modal closing into a re-rendered list — the user's
eye lands on the changed row instead of scanning the table.

**Anchor invariants:**

- Highlight kicks in on **both create AND edit** success, not just
  edit. Symmetric UX: every save → glow.
- Visual: **indigo ring** that fades after ~1500 ms. Use
  `ring-2 ring-indigo-500 ring-inset` (or equivalent), conditional
  on `highlightId === row.id`.
- **Best-effort, no scrolling.** If the user has filtered or
  sorted the row out of view, the highlight still fires but the
  user may not see it. Don't auto-scroll — surprise scrolling is
  worse than a missed highlight.
- The highlight **does not block subsequent interactions** —
  clicking another row, opening another modal, or sorting the
  list cancels the timer cleanly.
- **One timer, one row at a time.** Triggering the highlight on a
  new row cancels the previous timer.

**Shared hook:** `shared/hooks/useRowHighlight.ts` returns
`{ id, flash }`. Callers wire `flash(id)` into the modal's
`onSaved` and compare `id === row.id` in row className. Reference
implementations: `BeneficiariesPage`, `TagsPage`,
`TransactionsPage`. (`CategorizationRulesPage` has a feature-
specific variant that also handles group rebucket-and-expand on
top of the base highlight; it predates the shared hook and is
left in place.)

### Accessibility vs Preferences

Locked in the 2026-05-26 Batch 6.5 follow-up review. Two
distinct user-pref classes live in this app — they look similar
but persist and surface differently:

- **Accessibility** — frontend-only, no backend column. Survive
  reloads via `localStorage` (Zustand `persist`), do NOT follow
  the user across devices. Implemented as small Zustand stores
  with a `bridge` in `app/providers.tsx` that mirrors store state
  onto the `<html>` element (class or style). No-FOUC inline in
  `index.html` paints the initial state before React mounts.
  Examples: theme (light / dark / system), text size (zoom),
  reduced motion, privacy mask. Surfaced under a single
  **Accessibility** group — `<AccessibilityPopover />` on desktop
  (a single icon button in the top bar opening a popover with all
  four controls) and a dedicated **ACCESSIBILITY** section in the
  mobile drawer.
- **Preferences** — backend-persisted, follow the user across
  devices via the `UserPreferencesMiddleware` headers contract
  (§5 above). Examples: currency, country, timezone. Surfaced on
  the ProfilePage as the canonical edit surface. When Batch 9.5
  lands the Profile reorganization, the "defaults" cluster
  (default landing route, default debit/credit on Add
  Transaction, date-format / number-format overrides) joins this
  group; some of those *may* gain backend columns in a later
  batch (queued in implementation_plan.md "Backend follow-ups").

**Pattern for new Accessibility surfaces** (in case more get
added):

1. Zustand store with `persist` middleware + an `apply<X>(value)`
   imperative that mirrors state onto `<html>` (class, style, or
   data attribute).
2. `<XBridge />` in `app/providers.tsx` that calls `apply<X>` on
   mount + every store change.
3. No-FOUC inline `<script>` in `index.html` that paints the
   initial state from `localStorage` before React mounts.
4. CSS rule (when applicable) under `@layer base` in
   `src/index.css` that observes the `<html>` class.
5. UI control (`<XToggle />` or similar) shaped as a single
   labeled row — label on the left, control on the right — so it
   slots into both the drawer and the AccessibilityPopover.

**Money rendering for privacy mask compatibility.** Any element
that renders a currency amount must carry `className="money"` so
the privacy-mask CSS rule (`html.mask-amounts .money`) can blur
it. Examples in `features/transactions/pages/TransactionsPage.tsx`
amount cells. Future surfaces that render money adopt this
className as they're touched.

### Week convention

Locked in Batch 9.6 (2026-05-28). **Weeks are ISO 8601 — Monday
through Sunday — in the user's active timezone.** Applies to every
frontend surface that buckets data by week: the Tax Tracker
current-week card, every Dashboard week widget, the
`/transactions` calendar view, the bills generation picker, and
anything added later that needs a week boundary.

**Canonical helper:** `features/taxation/api/billPeriod.ts` →
`weekRangeInTz(date, tz)` returns
`{ period_start: <Mon YYYY-MM-DD>, period_end: <Sun YYYY-MM-DD> }`.
Never roll your own Monday math; use the helper so a future
convention change is one file. `fractionOfWeekElapsed` and
`precedingWeekStartInTz` also operate on ISO weeks.

**Backend status — TRANSITIONAL.** The backend's bill generator
(`backend/app/modules/taxation/taxation_services.py:_iter_week_ranges`)
still iterates Sun → Sat. Frontend display surfaces are
self-contained and already correct; the bill write path
(`GenerateBillsDialog` → `POST /api/consumption-tax/generate`) will
send Mon → Sun ranges that don't align with stored Sun → Sat
bills until the backend cutover lands. The ask is filed in
[`.scratch/task-handoff-fe-to-be.md §12`](../.scratch/task-handoff-fe-to-be.md)
as a high-priority backend follow-up. Until that lands, do **not**
batch-generate bills across the convention boundary.

**Naming.** Use `weekStart` / `weekEnd` (or `period_start` /
`period_end` when matching backend payload shape) — never
`mondayStart` / `sundayEnd`. The labels stay neutral so the next
convention change (if any) doesn't require a rename sweep.

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
