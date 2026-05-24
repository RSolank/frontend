# Frontend Architecture

> Skeleton — populated incrementally by Batches 1–9. The authoritative
> design today is [`CONTRIBUTING.md`](../CONTRIBUTING.md); this file
> diverges from it only when a batch lands code that needs to be
> described separately from the target shape.

## Where to look while this is empty

- **Target layout & layering rules** — [CONTRIBUTING.md §2](../CONTRIBUTING.md#-2-frontend-directory-structure-target)
  and [§3](../CONTRIBUTING.md#-3-tooling--workflow).
- **Locked architectural decisions (state lib, forms, styling, etc.)** —
  [CONTRIBUTING.md §10](../CONTRIBUTING.md#-10-architectural-decisions-resolved--planning-session-2026-05-24).
- **Refactor roadmap & batch plan** — [docs/refactor/implementation_plan.md](refactor/implementation_plan.md).
- **Per-feature module docs** — `docs/modules/<feature>.md` (each
  feature batch from 2–8 writes its own page; folder is empty during
  Batch 0).

## What this file will cover

Once Batch 1 lands `src/app/` and `src/shared/`, this page replaces
the pointer above with concrete sections:

- App shell (`src/app/App.tsx` + `providers.tsx` + `routes.tsx`).
- Providers (QueryClientProvider, store hydration, ErrorBoundary,
  Suspense fallback) and the order they wrap in.
- Routing model (`createBrowserRouter` + per-feature `RouteObject[]`
  + `protectedRoutes()` helper).
- Data-fetch story (TanStack Query keys, invalidation graph from
  CONTRIBUTING.md §5, MSW in tests).
- State story (Zustand stores per feature + `persist` for auth).
- Theme infrastructure (the `useThemeStore` + `<ThemeToggle />` that
  lands in Batch 1).
- Error boundary topology (global + per-feature `errorElement`).
