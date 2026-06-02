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
(default `http://localhost:4000`).

## Getting started

```bash
npm install
npm run dev        # Vite dev server on :5173
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (`:5173`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest run (happy-dom), coverage-free for speed |
| `npm run coverage` | Vitest run with v8 coverage → `coverage/` |
| `npm run typecheck` | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`) |
| `npm run lint` | ESLint (gate: 0 errors / 0 warnings) |
| `npm run format` / `format:check` | Prettier |
| `npm run size` | `size-limit` bundle budgets |
| `npm run gen:api` | Regenerate `src/shared/types/api.ts` from the backend OpenAPI schema |

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
└── shared/         # api (apiClient + routes registry), components,
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

Full detail:

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how we work: architecture
  principles, tooling, the code-quality gates, testing.
- [`docs/conventions.md`](docs/conventions.md) — the component / UI
  patterns to follow when building a feature (the playbook).
- [`docs/architecture.md`](docs/architecture.md) — layout, routing, data
  fetching, state, toolchain gates, user-preferences contract.
- [`docs/modules/`](docs/modules/) — one page per feature.
- [`docs/testing.md`](docs/testing.md) — Vitest + MSW + coverage.
- [`docs/performance.md`](docs/performance.md) — bundle budgets.
