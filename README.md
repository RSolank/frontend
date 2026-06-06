# Aevum — Frontend

React 18 + TypeScript SPA (Vite) for **Aevum**, the self-imposed
consumption-tax budgeting app. Track transactions, categorize them
with hierarchical tags, set per-category budgets, and review the
weekly tax bills the backend generates. ("Personal Budget" was the
working name before the BE Phase 2.11 rebrand; the npm package name
`personal-budget-frontend` and the repo path are kept as-is for
historical continuity.)

The backend is a separate FastAPI service (sibling `backend/` submodule).
This app talks to it over `/api/v1/*`; `VITE_API_URL` overrides the base
(default `http://localhost:4000`). **The override must not carry a
trailing slash** — request URLs are built by simple concatenation
(`${BASE_URL}${path}` where `path` starts with `/api/v1/...`), so a
trailing slash produces a double-slashed URL. Example: set
`VITE_API_URL=https://api.aevum.example.com`, not
`https://api.aevum.example.com/`.

## Getting started

```bash
npm install
npm run dev        # Vite dev server on :5173
```

## Scripts

| Command                           | What it does                                                         |
| --------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                     | Dev server (`:5173`)                                                 |
| `npm run build`                   | Production build to `dist/`                                          |
| `npm run preview`                 | Serve the production build                                           |
| `npm test`                        | Vitest run (happy-dom), coverage-free for speed                      |
| `npm run coverage`                | Vitest run with v8 coverage → `coverage/`                            |
| `npm run typecheck`               | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`)                 |
| `npm run lint`                    | ESLint (gate: 0 errors / 0 warnings)                                 |
| `npm run format` / `format:check` | Prettier                                                             |
| `npm run size`                    | `size-limit` bundle budgets                                          |
| `npm run gen:api`                 | Regenerate `src/shared/types/api.ts` from the backend OpenAPI schema |

## Architecture

Feature-based ("screaming") architecture: every feature owns its pages,
components, state, and `api/` folder under `src/features/<feature>/`.
Cross-cutting infrastructure lives in `src/shared/`. Features depend on
`shared/`, never the reverse.

```
src/
├── app/            # router + providers + App shell
├── features/       # auth, users, tags, beneficiaries,
│                   #   transactions (+ statement_upload/),
│                   #   categorization, taxation, budgets,
│                   #   recurring, bankAccounts,
│                   #   dashboard, account, settings, admin —
│                   #   each owns pages / components / state /
│                   #   api / <feature>.routes.tsx
└── shared/         # api (apiClient + routes registry + activity*,
                    #   branding, adminGate), components (TopNav bell
                    #   + ActivityFeedModal + SignalSettingsEditor),
                    #   hooks, state (Zustand stores), utils
```

Key conventions:

- **Server state** via TanStack Query; **client state** via Zustand
  (one store per domain). Every request goes through
  `shared/api/apiClient.ts`, and every URL through the central
  `shared/api/routes.ts` registry — no inline `/api/v1/...` strings.
- **User preferences** (currency / number format / date format /
  timezone / theme + 10 accessibility stores) drive presentation
  client-side via `Intl` + CSS; the backend stores the preference.
- **DetailModal** convention for CRUD edit surfaces, ISO Mon–Sun weeks
  project-wide, and `SearchableSelect` for large data-driven dropdowns.
- **Profile/auth domain split** — profile-domain reads come from
  `/api/v1/users/me`; auth-domain state (2FA flag, recovery configured,
  backup codes remaining, sessions, devices) reads from
  `/api/v1/auth/*` (notably `/auth/security` for the protection
  snapshot). Mirrors the backend's screaming-architecture split — see
  [`docs/modules/auth.md`](docs/modules/auth.md) and
  [`docs/modules/account.md`](docs/modules/account.md).
- **Idle-time prefetch** — click-gated chunks (TopNav menus, lazy
  modals, route chunks) warm via `prefetchOnIdle(fn, delayMs)` after
  the user lands, staggered 2–8 s by most-clicked-first. Trades a
  slightly hotter idle window for zero click latency. See
  [`docs/conventions.md` §Idle-time prefetch](docs/conventions.md#idle-time-prefetch).

Full detail:

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how we work: architecture
  principles, tooling, the code-quality gates, testing.
- [`docs/conventions.md`](docs/conventions.md) — the component / UI
  patterns to follow when building a feature (the playbook).
- [`docs/architecture.md`](docs/architecture.md) — layout, routing, data
  fetching, state, toolchain gates, user-preferences contract.
- [`docs/modules/`](docs/modules/) — one page per feature; also
  [`docs/modules/activity.md`](docs/modules/activity.md) for the
  cross-cutting activity-feed surface (TopNav bell + lazy modal +
  user/admin signal-settings) that lives in `shared/`.
- [`docs/testing.md`](docs/testing.md) — Vitest + MSW + coverage.
- [`docs/performance.md`](docs/performance.md) — bundle budgets.

## Deployment

Static-site deploy via [`render.yaml`](render.yaml). The backend
deploys independently as a sibling Render service; `VITE_API_URL`
(set in the Render dashboard, **no trailing slash**) points at it.
SPA fallback for hard-refreshes on deep routes ships in
[`public/_redirects`](public/_redirects); `render.yaml` carries the
same rewrite belt-and-suspenders.

The BE serves a `capabilities` object on `/api/v1/metadata/branding`
that can disable individual features per deployment (e.g. profile-
image uploads need persistent disk; statement parsing is CPU-heavy).
The FE gating + per-feature `feature_disabled` error handler live in
[`src/shared/api/capabilities.ts`](src/shared/api/capabilities.ts);
see [`docs/archive/platform-upgrade-v1.0/uat-and-pre-deploy.md`](docs/archive/platform-upgrade-v1.0/uat-and-pre-deploy.md)
for the design rationale. Free-tier services sleep after 15 min
idle; the bottom-left
[`<ServiceWakingNotice>`](src/shared/components/ServiceWakingNotice.tsx)
covers the ~30 s cold-boot so users don't think the app is broken.

## Archives

- [`docs/archive/refactor-v1.0/`](docs/archive/refactor-v1.0/) — the
  feature-architecture refactor that reshaped `src/` into the current
  feature-based layout (2026-05-24 → 2026-05-31).
- [`docs/archive/platform-upgrade-v1.0/`](docs/archive/platform-upgrade-v1.0/)
  — the platform upgrade that wired BE Phases 1.1–2.16 + 3.0 into the
  FE and shipped the deploy-ready frontend (2026-05-31 → 2026-06-06).
  Three docs: `summary.md` (what landed), `log.md` (per-batch history),
  `uat-and-pre-deploy.md` (UAT findings + pre-deploy decisions).
