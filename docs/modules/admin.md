# Admin portal

> The admin-only surface at `/admin/*`. Lives at
> [`src/features/admin/`](../../src/features/admin/).

## Purpose

Operator-only entry point. Backed by BE Phase 1.11
(`b8db9b5`, `auth.role-enum`) which adds `UserAuth.role` (`"user" |
"admin"`, default `"user"`) + a reusable `require_role(Role.ADMIN)`
dependency + the new `/api/v1/admin/*` prefix. The only endpoint
currently is the probe `GET /api/v1/admin/ping` — concrete admin tools
(user list, ops metrics, cemetery audit) ship in later BE phases.

## Gate

`role` isn't yet exposed on `/api/v1/users/me`, so the FE gates on a
successful ping rather than on a `/me` field. When the BE adds the
field (coordinated drop with the admin-tools work) the gate switches
to read from `/me` in a one-line edit.

[`shared/api/adminGate.ts`](../../src/shared/api/adminGate.ts):

- `checkAdminGate(): Promise<boolean>` — never throws; 200 → `true`,
  every other status (403 / 401 / network / 5xx) → `false`. Fails
  closed (the right default for a privilege probe).
- `useAdminGateQuery(enabled?)` — React Query wrapper, 30-minute
  staleTime. Caller passes `enabled: false` for unauthenticated
  visitors so we don't burn a request that would 401.

Lives in `shared/` not `features/admin/` because the TopNav user
dropdown — a cross-feature surface — consumes it, and the
dependency-direction rule blocks `shared/` from importing
`features/`.

## Routes

[`admin.routes.tsx`](../../src/features/admin/admin.routes.tsx) —
lazy-imports the landing page, mounted at `/admin` (any deeper path
bounces back via `<Navigate>` until concrete sub-routes ship).
Wrapped by the parent `<ProtectedRoute>` in `app/routes.tsx`.

## Pages

| Path | Component | Content |
|---|---|---|
| `/admin` | `pages/AdminLandingPage.tsx` | Two-state scaffold. When the gate returns true, renders an "Admin tools" heading + the "Access gate (live)" card confirming the ping returned 200 + a "Coming soon" panel listing the future tools. When the gate returns false (or 403 / 401 / network), renders a "Not available" panel with a Back-to-dashboard link. |

## TopNav integration

The user dropdown ([`shared/components/TopNav.tsx`](../../src/shared/components/TopNav.tsx))
runs `useAdminGateQuery()` and renders an "Admin tools" link
between "Account" and "Sign Out" when the gate passes. Non-admins
never see the link; the underlying query resolves to `false`
without an error.

## Tests

| File | Covers |
|---|---|
| `shared/api/adminGate.test.tsx` | 200 → true, 403 → false, 401 → false, 5xx → false (fails closed). |
| `pages/AdminLandingPage.test.tsx` | Admin scaffold renders when gate returns 200; "Not available" panel renders when gate returns 403. |

MSW default for `/api/v1/admin/ping` is 403 (the common path); admin
tests override with `server.use(...)` to return 200.
