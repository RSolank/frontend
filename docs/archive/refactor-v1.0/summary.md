# Frontend feature-architecture refactor — summary (v1.0)

> The *what* of the v1.0 frontend refactor: goal, the architectural
> decisions it locked, the shape that actually shipped, the conventions it
> established, and the backend follow-ups it deferred. For the chronological
> *how* — per-batch dates, commit SHAs, mid-flight pivots, and debugging
> notes — see [`log.md`](log.md).

## Goal

Reshape `frontend/src/` from a by-technical-layer tree (`pages/`,
`components/`, `state/`, `utils/`) into a **feature-based ("screaming")**
layout under `src/features/<feature>/` that mirrors `backend/app/modules/`.
Anyone working across the stack can open `backend/app/modules/<X>` and
`frontend/src/features/<X>` and see the matching pair. Along the way the
refactor resolved the cross-cutting toolchain decisions (state library, form
library, styling, linting, TypeScript) that had been left open.

Two standing constraints held for the whole project:

- **No new product features and no backend-shape changes.** The work was
  structural. Anything that would have required touching an `/api/...` shape
  was deferred to a backend follow-up (see the bottom of this doc) rather
  than coupling the two refactors.
- **The visual upgrade rode along.** Every component touched during a feature
  batch was re-skinned to the target visual language (Linear / Stripe /
  Vercel tier) in the same pass — never left as the old plain look behind
  Tailwind utilities.

## Locked architectural decisions

These were resolved in the planning session and held across all batches. They
are the enduring contract; `CONTRIBUTING.md` §3 and `docs/architecture.md`
carry the live version.

| Area | Choice |
|---|---|
| **Layout** | Feature-based under `src/features/<feature>/`; each feature owns its `pages / components / state / api / <feature>.routes.tsx`. Cross-cutting infra in `src/shared/`. Features depend on `shared/`, never the reverse (enforced by `eslint-plugin-boundaries`). |
| **Feature naming** | Mirrors the backend module vocabulary (`auth`, `users`, `tags`, `beneficiaries`, `transactions` + `statement_upload`, `categorization`, `taxation`, `budgets`) plus the frontend-only `dashboard`, `account`, `settings`. |
| **Server state** | TanStack Query v5. Every request goes through `shared/api/apiClient.ts`; every URL through the central `shared/api/routes.ts` registry — no inline `/api/...` strings. |
| **Client state** | Zustand, one store per domain (`useAuthStore` replaced the old `AuthContext`; preferences + the accessibility stores follow the same shape). |
| **Forms** | react-hook-form + Zod; the Zod schema doubles as the TypeScript request type. |
| **Styling** | Tailwind v4 with `@layer components` for shared patterns; class-based dark mode via `@custom-variant`. |
| **Types** | TypeScript strict (`noUncheckedIndexedAccess`), migrated per-feature as each batch moved files. The API surface is generated into `src/shared/types/api.ts` from the backend OpenAPI schema via `npm run gen:api`. |
| **Routing** | `createBrowserRouter` + per-feature `RouteObject[]` composed by `src/app/routes.tsx`; `protectedRoutes()` wraps authed routes. Global `ErrorBoundary` + per-feature `errorElement`. |
| **Tests** | Vitest (happy-dom), colocated `*.test.tsx`; MSW mocks the backend, with handlers under `src/test/handlers/<feature>.ts`. |
| **Bundle gate** | `size-limit` on the first-paint bundle (see drift note below for the final numbers). |

## Final shape that shipped

The refactor ran as a numbered batch series. The plan had 13 batches; the
ship expanded to 28 named-batch commits, because Batches 9 and 10 each grew
into a reviewable sub-series (see "Planned vs shipped" below). One-line
summary of each shipped unit:

- **Batch 0** — tooling baseline (ESLint flat + Prettier, TS strict, TanStack
  Query, Zustand, react-hook-form + Zod, Tailwind v4, MSW, `size-limit`,
  OpenAPI types, docs skeleton).
- **Batch 1** — `shared/` + `app/` shell + theme (light/dark/system, no-FOUC)
  + the user-preferences header infrastructure.
- **Batch 2** — `auth` feature; Register gains a timezone field; preferences
  hydration on login.
- **Batch 3** — `users` + `metadata` features.
- **Batch 4** — `tags` + `beneficiaries`; the web-first / responsive design
  contract was written here.
- **Batch 5** — `transactions` + `statement_upload`.
- **Batch 6** — `categorization`.
- **Batch 6.5** — app-shell upgrade + the migration of CRUD sub-flows to the
  modal-first pattern (mid-flight insertion).
- **Batch 7** — `taxation` move + Tax Tracker enhancement.
- **Batch 8** — `budgets` (the Expense Tracker).
- **Batch 8.5** — Dashboard (mid-flight insertion).
- **Batch 9** — Settings shell + Account surface + 10 accessibility stores +
  sidebar, then a sub-series: **9.1** polish + Help + Indian-number grouping ·
  **9.5** ExpenseTracker anomaly badges + Dashboard week-by-category · **9.6**
  Calendar view + filter overhaul (locked the ISO-week / DetailModal /
  SearchableSelect conventions) · **9.8** cross-feature convention enforcement
  + DetailModal seamless transition + folded audits.
- **Batch 10** — ship-it series **10.1**–**10.12**: central routes registry ·
  ESLint on the TS tree + complexity/sonarjs gates · preferences audit ·
  coverage wiring + Lighthouse · docs sweep + README · legacy-dir cleanup ·
  feature-boundary groundwork · safe lint remediation · boundary enforcement ·
  complexity decomposition · post-refactor follow-ups + lint board to 0/0 ·
  gates promoted to error + conventions codified.

The series merged to the frontend submodule `main` as a single `--no-ff`
merge tagged `frontend-v1.0-refactor`.

## Patterns and conventions established

The reusable patterns are catalogued, present-tense, in
[`docs/conventions.md`](../../conventions.md) — the playbook to follow when
building a feature. In brief, the refactor established:

- **Visual design language** — Linear/Stripe/Vercel tier; indigo accent;
  move-and-upgrade in the same pass.
- **Modal-first CRUD** — create/edit sub-flows open a shared `Modal`;
  destructive actions use `ConfirmDialog`, never `window.confirm()`.
- **DetailModal** — one `⋯`-triggered modal is both the view and the edit
  surface for a record, with a seamless read→edit transition (form always
  rendered, `readOnly` inputs + a locked-field banner).
- **SearchableSelect** — typeahead dropdown required for large or
  data-driven option lists.
- **ISO Mon–Sun weeks** project-wide, in the user's timezone.
- **Accessibility stores vs. preferences** — accessibility toggles (zoom,
  theme, motion, privacy, etc.) are local Zustand-persisted stores;
  presentation preferences (currency, number/date format, timezone) hydrate
  from the backend on login and format client-side via `Intl` + CSS.
- **Responsive contract** — web-first with documented reflow tiers per
  feature.

## Planned vs shipped (notable drift)

The plan was forward-looking; the ship diverged in a few deliberate ways
worth recording for future maintainers:

- **Batches 9 and 10 expanded into sub-series** (9 → 5 commits, 10 → 12).
  The monolithic plan entries underestimated scope (accessibility stores,
  conventions, calendar for 9; all deferred audits + a full complexity
  decomposition for 10). The "one commit per batch" rule was deliberately
  relaxed for these two so each shippable unit stayed independently
  reviewable. Sub-numbers `9.2/9.3/9.4` were a reserved-and-unused gap;
  `9.7` (recurring-transactions UI) was dropped to the post-refactor backlog
  because it gated on backend work.
- **Lint gates run stricter than the plan asked.** The plan set
  `complexity: 12` / `max-lines-per-function: 80` as warnings; the ship runs
  **15 / 200** as diagnostic ceilings, promoted to **error** severity for the
  sonarjs recommended set + complexity gates, with a **ratchet rule** (a
  ceiling that may tighten, never loosen). The lint board is held at
  **0 errors / 0 warnings** via `eslint --max-warnings 0`.
- **No CI runner was wired.** `size-limit` and coverage are green **local**
  npm scripts with thresholds, not build-failing CI gates — that promotion is
  expected to land with the backend platform CI work.
- **Bundle budget reconciled to ≤ 125 KB gz first-paint JS** (the plan said
  ≤ 120). The ≤ 80 KB per-feature lazy-chunk target is documented but not yet
  wired into `size-limit`.
- **Coverage enforces a flat 60% global** (Vitest thresholds, passing); the
  80% critical-path target is documented as aspirational and not yet met —
  it needs per-glob thresholds.
- **`/api/v1` prefix not applied.** `routes.ts` ships with `const V = '/api'`;
  the one-line flip waits on the backend v1 cutover.

## Backend follow-ups deferred

The refactor identified these backend gaps and worked around each locally;
none blocked any batch. They remain open and are the natural next backend
tasks:

1. **`/api/metadata/countries` → return `timezones: List[str]` per country.**
   The frontend currently bundles the `countries-and-timezones` package
   (~30 KB gz) behind `src/shared/utils/countryTimezones.ts`; once the API
   returns the list, drop the package and read from the API (one-file swap).
2. **Persist `UserProfile.timezone`.** The frontend already sends
   `x-user-timezone` on every request and includes `timezone` in the Register
   payload; the backend needs to store and return it so an explicit override
   survives across logins.
3. **Cross-device sync for the accessibility stores** (zoom/text-size, theme,
   motion, privacy). These persist locally via Zustand today; syncing each
   needs a column on the profile/preferences surface plus a one-line
   extension to the preferences hydration path.
4. **Defaults-cluster persistence** — `default_landing_route`,
   `default_txn_kind`, `date_format`, `number_format`. Until these persist,
   the defaults stay hardcoded (login → `/dashboard`, Add Transaction →
   debit, dates → tz-derived, numbers → locale-derived). The single date-format
   swap point is `features/taxation/api/billPeriod.ts:formatBillDate`.
