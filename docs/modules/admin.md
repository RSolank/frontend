# Admin portal

> The operator-only surface at `/admin/*`. Lives at
> [`src/features/admin/`](../../src/features/admin/).

## Purpose

Operator entry point. The portal scaffold landed alongside
BE Phase 1.11 (`b8db9b5`, `auth.role-enum`) — `UserAuth.role`
(`"user" | "admin"`, default `"user"`) + a reusable
`require_role(Role.ADMIN)` dependency + the `/api/v1/admin/*`
prefix. **T-admin (BE Phase 2.16, `7b0e24b`)** populated the
surface with the A1-E1 operator deliverables, all wired in
**Platform FE Batch 18 (`bb900e1`)**:

| Sub-task | What ships |
|---|---|
| **A1** — `/me.role` | `role` exposed on `/api/v1/users/me`; admin gate switched off the `/admin/ping` probe |
| **A2** — Users list | `GET /api/v1/admin/users` paginated, search (email/name), opaque keyset cursor, `?include_deleted` flag |
| **A3** — User detail | `GET /api/v1/admin/users/{id}` — identity + locale, recent sessions + known devices, recent activity, stats, cemetery status |
| **B1** — Lock/Unlock | `PATCH /api/v1/admin/users/{id}/lock {reason?}` / `/unlock` over recovery-proof `UserAuth.disabled_at` |
| **B2** — Force logout | `DELETE /api/v1/admin/users/{id}/sessions` — locks every active session row, idempotent |
| **C1** — Cemetery audit | `GET /api/v1/admin/cemetery` (paginated/searchable) + `/{deleted_user_id}` detail (≤10 replica peeks) |
| **D1** — Bill backfill | FE-only operator wrap around BE Phase 2.6's `POST /api/v1/consumption-tax/admin/bills/generate` |
| **E1** — Signal controls | `GET/PUT /api/v1/admin/users/{id}/signal-settings` (per-user disable) + `PUT /api/v1/admin/signal-catalog/{kind}` (system-wide priority / rank / system_enabled tunables) |

Plus BE-side hygiene that lights up the FE: `ADMIN_BOOTSTRAP_EMAILS`
(promote operator accounts on init), the generic SMTP email provider
(`EMAIL_PROVIDER=smtp`), and avatar presets switched from geometric to
generic-user glyph (12 colour variants, `avatar-NN`).

## Gate

The admin gate is a **synchronous** read on `useAuthStore.user.role`
— no network round-trip. The `/me.role` field is required on
`UserPrivateResponse` server-side, so by the time `<ProtectedRoute>`
admits a request to any page, the role is already in the auth store
from boot-time `refreshAuthUser()`.

[`shared/api/adminGate.ts`](../../src/shared/api/adminGate.ts):

- `useAdminGateQuery()` — wraps a sync `useAuthStore((s) => s.user?.role === 'admin')`
  selector behind a React-Query interface so consumers (TopNav,
  AdminLandingPage, page-level gates) all observe the same boolean
  without storing it per-component. Returns `{ data: boolean }`.

Lives in `shared/` because the TopNav user dropdown (a cross-feature
surface) consumes it; the `shared/ ↛ features/` boundary rule blocks
placing it in `features/admin/`.

The legacy `GET /api/v1/admin/ping` endpoint stays around as an
**ops liveness probe** (it's still hit by infra-side smoke checks)
but no longer drives the FE gate.

## Routes

[`admin.routes.tsx`](../../src/features/admin/admin.routes.tsx) —
six lazy routes, all under the parent `<ProtectedRoute>` wrap, plus
a catch-all that bounces back to `/admin`:

| Path | Component |
|---|---|
| `/admin` | `<AdminLandingPage>` |
| `/admin/users` | `<AdminUsersPage>` |
| `/admin/users/:userId` | `<AdminUserDetailPage>` |
| `/admin/cemetery` | `<AdminCemeteryPage>` |
| `/admin/cemetery/:deletedUserId` | `<AdminCemeteryDetailPage>` |
| `/admin/ops/bill-backfill` | `<AdminBillBackfillPage>` |
| `/admin/*` | `<Navigate to="/admin" replace>` |

Non-admins hitting any of these see the "Not available" panel
rendered by each page from a top-of-page `useAdminGateQuery()`
check; the route itself is reachable (chunk loads) but the page
short-circuits.

## Pages

| Path | Component | Content |
|---|---|---|
| `/admin` | `pages/AdminLandingPage.tsx` | Landing card with deep-links to Users, Cemetery, Ops. Renders the "Not available" panel for non-admins. |
| `/admin/users` | `pages/AdminUsersPage.tsx` | Paginated user inventory. Header: search + include-deleted toggle. Cursor-based "Load more". Rows: avatar (initials), email, full name, role badge, status chip (Active / Locked / Disabled / Pending deletion), 2FA flag, session count, last active. Row → `/admin/users/:id`. |
| `/admin/users/:userId` | `pages/AdminUserDetailPage.tsx` | Seven sections: Identity (email, name, dob masked, country, currency, tz, registered at, last active, status chip), ActionBar (Lock/Unlock + Force-logout + status banner), RecentSessions, RecentDevices, RecentActivity (≤5 items via the shared activity-feed reader), Stats (member-since, total txns, total budgets, total beneficiaries, active recurring), SignalSettings (per-user + admin catalog tunables via the shared `<SignalSettingsEditor viewerRole="admin">`). Cemetery banner when `cemetery_status` is populated. |
| `/admin/cemetery` | `pages/AdminCemeteryPage.tsx` | Post-deletion audit. Header: search (email ILIKE) + date-range (`from`/`to` over `deleted_at`). Rows: former email, full name, country, currency, account-opened-at, deleted-at, committee-bill count, expense-total count. Row → `/admin/cemetery/:id`. |
| `/admin/cemetery/:deletedUserId` | `pages/AdminCemeteryDetailPage.tsx` | Headstone summary + collapsible peeks (≤10 rows each) into the committee-bill replicas and the expense-total replicas. 404 when the id was never entombed. |
| `/admin/ops/bill-backfill` | `pages/AdminBillBackfillPage.tsx` | Operator wrap around the BE Phase 2.6 endpoint. Typeahead user picker (`<AdminUserPicker>`) + ISO-week date range (Mon→Sun snapping) + ConfirmDialog gate + session-local action log (last 20 invocations: user / weeks_processed / bills_generated / when). |

## Components

[`components/`](../../src/features/admin/components/):

- `AdminUserPicker.tsx` — typeahead search over `GET /api/v1/admin/users?q=` for the bill-backfill form. Debounced 150 ms input; renders the top 8 hits with email + full name; arrow-key + Enter selection; Esc closes. Used in bill-backfill, designed to be reusable for future ops forms.
- `LockUserDialog.tsx` — Modal that fronts the lock-account action. Optional `reason` field (max 280 chars, stamped into the BE audit log). ConfirmDialog gate on submit; surfaces 409 (already locked) inline. The unlock action uses a plain `ConfirmDialog` (no reason).

## API

[`api/`](../../src/features/admin/api/):

| File | Exports |
|---|---|
| `keys.ts` | `adminKeys` — `all`, `users(params)`, `userDetail(userId)`, `cemetery(params)`, `cemeteryDetail(id)`, `signalSettings(userId)` |
| `users.ts` | `AdminUserRow` type, `fetchAdminUsers(params)`, `useAdminUsersInfiniteQuery` |
| `userDetail.ts` | `AdminUserDetail` type, `fetchAdminUserDetail(userId)`, `useAdminUserDetailQuery` |
| `mutations.ts` | `lockUserRequest(userId, reason?)`, `unlockUserRequest(userId)`, `forceLogoutRequest(userId)` |
| `cemetery.ts` | `AdminCemeteryRow` / `AdminCemeteryDetail` types, `fetchAdminCemetery(params)`, `useAdminCemeteryInfiniteQuery`, `fetchAdminCemeteryDetail(id)`, `useAdminCemeteryDetailQuery` |
| `billBackfill.ts` | `BackfillRequest` / `BackfillResponse` shapes, `runBillBackfillRequest(payload)` |
| `signalSettings.ts` | `useAdminUserSignalSettingsQuery(userId)`, `useUpdateAdminUserSignalMutation(userId)`, `useTuneAdminSignalCatalogMutation()` |

## Cross-feature seams

- **Activity feed reader** — `<AdminUserDetailPage>` consumes
  [`shared/api/activityFeed.ts`](../../src/shared/api/activityFeed.ts)
  + [`activityCatalog.ts`](../../src/shared/api/activityCatalog.ts)
  to render the RecentActivity section; the BE A3 payload carries
  `recent_activity: ActivityItemOut[]` directly so no extra request
  is needed beyond the user-detail fetch.
- **Shared signal-settings editor** — the SignalSettings section on
  `<AdminUserDetailPage>` renders
  [`shared/components/SignalSettingsEditor.tsx`](../../src/shared/components/SignalSettingsEditor.tsx)
  with `viewerRole="admin"` + an `onTune` callback. The same editor
  powers the user-side `/account/notifications` tab with
  `viewerRole="user"` and no `onTune`. Stateless by design — the
  caller owns the queries + mutations.
- **TopNav admin link** — the user dropdown in
  [`shared/components/TopNavMenus.tsx`](../../src/shared/components/TopNavMenus.tsx)
  (lazy chunk) calls `useAdminGateQuery()` and renders an "Admin
  tools" link between "Account" and "Sign Out" when the gate
  passes. Non-admins never see the link.

See [activity.md](activity.md) for the full activity-surface
contract.

## API surface (consumed)

| Method + path | Used by |
|---|---|
| `GET /api/v1/admin/users` | `AdminUsersPage` list + `AdminUserPicker` typeahead |
| `GET /api/v1/admin/users/{id}` | `AdminUserDetailPage` |
| `PATCH /api/v1/admin/users/{id}/lock` | `AdminUserDetailPage` ActionBar — Lock |
| `PATCH /api/v1/admin/users/{id}/unlock` | `AdminUserDetailPage` ActionBar — Unlock |
| `DELETE /api/v1/admin/users/{id}/sessions` | `AdminUserDetailPage` ActionBar — Force logout |
| `GET /api/v1/admin/cemetery` | `AdminCemeteryPage` |
| `GET /api/v1/admin/cemetery/{id}` | `AdminCemeteryDetailPage` |
| `POST /api/v1/consumption-tax/admin/bills/generate` | `AdminBillBackfillPage` |
| `GET /api/v1/admin/users/{id}/signal-settings` | `AdminUserDetailPage` SignalSettings |
| `PUT /api/v1/admin/users/{id}/signal-settings` | `AdminUserDetailPage` SignalSettings (per-user toggle) |
| `PUT /api/v1/admin/signal-catalog/{kind}` | `AdminUserDetailPage` SignalSettings (admin catalog tune) |
| `GET /api/v1/admin/ping` | (legacy — ops liveness probe; no longer drives the FE gate) |

## Tests

| File | Covers |
|---|---|
| `pages/AdminLandingPage.test.tsx` | Landing card renders for admins; "Not available" panel for non-admins. |
| `pages/AdminUsersPage.test.tsx` | List render, search input drives `?q=`, "Load more" appends rows on cursor, include-deleted toggle flips the query param, gate fails closed for non-admins. |
| `pages/AdminUserDetailPage.test.tsx` | Sections render, status chip variants (Active / Locked / Disabled / Pending deletion), Lock confirm → PATCH lock; Unlock; 409 friendly message; Force-logout disabled at 0 sessions + reports terminated count; Activity hidden on null; not-found panel on 404 / non-numeric param; SignalSettings section renders + toggles fire admin PUT. |
| `pages/AdminCemeteryPage.test.tsx` | List render + cursor pagination + search-by-email. |
| `pages/AdminCemeteryDetailPage.test.tsx` | Headstone summary, replica peek collapsibles, 404. |
| `pages/AdminBillBackfillPage.test.tsx` | Typeahead user picker, week-range snapping, ConfirmDialog gate, action log accrual on success. |
| `shared/api/adminGate.test.tsx` | Selector returns true on admin role, false on user / null. |

MSW handlers live at
[`src/test/handlers/admin.ts`](../../src/test/handlers/admin.ts)
with permissive defaults (empty lists / 404 detail / accept lock/unlock/force-logout / accept signal-setting writes); tests override
via `server.use(...)` to assert request bodies and exercise error paths.
