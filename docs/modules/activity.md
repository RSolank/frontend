# Activity surface

> Cross-feature activity feed — backend-originated worker / engine
> events surfaced through the TopNav bell, the user-side
> `/account/notifications` tab, and the admin user-detail page.
> Lives **shared/-side** at
> [`src/shared/api/activity*`](../../src/shared/api/) +
> [`src/shared/components/Activity*`](../../src/shared/components/)
> +
> [`src/shared/components/SignalSettingsEditor.tsx`](../../src/shared/components/SignalSettingsEditor.tsx).

## Purpose

- Render the BE-owned activity feed (BE Phase 2.4 originally; v2
  engine cutover in Phase 2.14, persistence fix + admin operator
  layer in Phase 2.16). One canonical surface for every worker /
  engine event the user needs to see — bill generated, budget
  breached, statement import failed, new device, recurring bill
  pending, recurring bill upcoming, account-security setup
  incomplete, backup codes low, beneficiary needs classification,
  tax mode auto-disabled, etc.
- Honor the BE-owned **ranking** (the FE never re-sorts) and the
  BE-owned **event_class** split (NOTIFICATION vs ALERT) — Alerts
  outrank Notifications in the same surface, but ordering inside
  each section is BE rank-order.
- Surface a 3-state acknowledgement model — UNSEEN → soft-acked
  (rendered) → hard-acked (clicked). The BE owns dedupe; the FE
  fires the seen mutations.
- Give users per-kind enable/disable control over the feed via
  `/account/notifications`; give admins per-user disable + system-
  wide priority / rank / system_enabled tunables via the admin
  user-detail page.

## Surfaces

Lives across three FE consumers; the contract is one BE-side
endpoint set:

| Surface | What it renders | Owner |
|---|---|---|
| **TopNav bell** — [`shared/components/ActivityBell.tsx`](../../src/shared/components/ActivityBell.tsx) | Lazy-loaded modal trigger. Badge counts UNSEEN items across both classes with a "5+" cap. Lives on every authenticated page. | App shell |
| **Activity feed modal** — [`shared/components/ActivityFeedModal.tsx`](../../src/shared/components/ActivityFeedModal.tsx) | Lazy chunk imported by the bell on first click. Renders Alerts section, then Notifications section, in the same modal (not tabs). Capped at 10 items total, with the split between sections driven by BE rank order. Soft-acks on render (once per `event_id` per session via `SEEN_THIS_SESSION` set), hard-acks on row click — row click now opens **`<ActivityDetailModal>` in place** (Batch 20 UAT, `0791964`) rather than full-page deep-linking, with per-subject CTAs surfaced inside. "All clear — nothing new" empty state. "Manage notifications →" footer link to `/account/notifications`. | App shell |
| **Activity detail modal** — [`shared/components/ActivityDetailModal.tsx`](../../src/shared/components/ActivityDetailModal.tsx) | In-place expansion of a single activity row. Hosts the per-subject CTAs derived from [`shared/utils/activitySubject.ts`](../../src/shared/utils/activitySubject.ts) (`subjectMeta()` maps each `subject_type` → CTA label + deep-link target). Replaces the prior full-page-navigation pattern so users stay in the feed context. | App shell |
| **User Notifications tab** — [`features/account/pages/AccountNotificationsPage.tsx`](../../src/features/account/pages/AccountNotificationsPage.tsx) | Per-kind enable/disable for the user's own feed. Renders the shared `<SignalSettingsEditor viewerRole="user">`. | [account.md](account.md) § Notifications |
| **Admin user-detail signal section** — `<SignalSettingsSection>` in [`features/admin/pages/AdminUserDetailPage.tsx`](../../src/features/admin/pages/AdminUserDetailPage.tsx) | Per-user disable for the admin'd account + system-wide catalog tunables (priority / rank_order / system_enabled). Renders the shared `<SignalSettingsEditor viewerRole="admin">` with `onTune` wired. | [admin.md](admin.md) § Pages |

## Components

### `ActivityBell` (`shared/components/ActivityBell.tsx`)

TopNav trigger. Renders the `Bell` lucide icon + a UNSEEN-count
badge. Badge logic:

- Counts items the user hasn't soft-acked yet in this session.
- Caps display at "5+" so a backlog doesn't blow the chip width.
- Hidden entirely when count is 0.

Click handler `lazy()`-imports `ActivityFeedModal`. Lives in
`shared/components/` (not `features/`) because TopNav consumes
it; `shared/ ↛ features/` boundary rule applies.

### `ActivityFeedModal` (`shared/components/ActivityFeedModal.tsx`)

Lazy-loaded modal opened by the bell. Fetches the feed once
(`useActivityFeedQuery(10)`) + the catalog
(`useActivityCatalogQuery()`), splits items by
`event_class` via `buildEventClassIndex(catalog)`, and renders:

1. **Alerts section** — items where `event_class === 'alert'`.
2. **Notifications section** — items where
   `event_class === 'notification'`.

Within each section, the BE rank order is preserved verbatim
(`magnitude` + `rank_order` + `priority` are server-resolved into
a deterministic order). Section headers render only when the
section is non-empty; "All clear — nothing new" renders when both
are empty.

**Acknowledgement model:**

- **Soft-ack** fires on modal open for every item the user
  hasn't soft-acked yet in this session. Single batched
  `POST /activity/seen {refs, hard: false}` call with
  per-`event_id` dedupe via a module-level `SEEN_THIS_SESSION`
  set. BE dedupes per cycle too — fire-and-forget is fine.
- **Hard-ack** fires on row click before the `<ActivityDetailModal>`
  opens (`POST /activity/seen {refs, hard: true}`). Removes the
  row from the BE's UNSEEN set; the next bell render reflects
  the new count. The row's CTA (if any) is then surfaced inside
  the detail modal — opening the row IS the acknowledgement; the
  user picks the action from there.

`ModalBody` is a separate component to avoid nested ternaries
(sonarjs rule).

### `SignalSettingsEditor` (`shared/components/SignalSettingsEditor.tsx`)

Stateless editor. Caller owns the query + mutation; editor
receives:

```ts
interface SignalSettingsEditorProps {
  catalog: CatalogResponse | undefined;
  disabled: string[];
  viewerRole: 'admin' | 'user';
  busyKinds?: Set<string>;
  onToggle: (kind: string, enabled: boolean) => void;
  onTune?: (
    kind: string,
    patch: { priority?; rank_order?; system_enabled? }
  ) => void;
}
```

- Groups kinds by `domain` (`DOMAIN_LABELS` map: Tax & bills,
  Budgets, Auth, Account security, Recurring, Statement imports,
  Beneficiaries, Bank).
- Kind labels derived from `kind` ID via Title-Case-from-snake-case.
- **User-side** (`viewerRole="user"`): disabled checkbox; rows
  with `system_enabled=false` get a "System off" badge and the
  toggle is disabled (the user can't override a system-disabled
  kind).
- **Admin-side** (`viewerRole="admin"`): same toggle interactive
  on system-off rows + an `<AdminTuneRow>` "Advanced tuning"
  disclosure exposing priority / rank_order / system_enabled
  controls. When `onTune` is omitted, the disclosure doesn't
  render.

Placed in `shared/components/` because two `features/` modules
(account, admin) consume it; `shared/ ↛ features/` boundary rule
applies.

## API

[`shared/api/activity*`](../../src/shared/api/):

| File | Exports |
|---|---|
| `activityKeys.ts` | `activityKeys` — `all`, `feed(limit)`, `catalog()`, `signalSettings()`, `adminUserSignalSettings(userId)` |
| `activityFeed.ts` | `ActivityFeedItem` shape, `ActivitySeenRef` + `ActivitySeenRequest`, `fetchActivityFeed`, `markActivitySeen`, `itemsToSeenRefs`, `useActivityFeedQuery(limit, enabled)`, `useUserSignalSettingsQuery(enabled)`, plus the user-side signal-settings GET / PUT helpers |
| `activityCatalog.ts` | `CatalogEntry` + `CatalogResponse` types, `useActivityCatalogQuery`, `buildEventClassIndex(catalog)` (Map<kind, event_class>) |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/v1/activity?limit=N` | Activity feed modal — list of items, server-ordered |
| `POST /api/v1/activity/seen` | Soft + hard acks (body shape below) |
| `GET /api/v1/activity/catalog` | Activity feed modal (event_class split) + SignalSettingsEditor (kind list + domain grouping) |
| `GET /api/v1/activity/signal-settings` | Account → Notifications |
| `PUT /api/v1/activity/signal-settings` | Account → Notifications toggle |
| `GET /api/v1/admin/users/{id}/signal-settings` | Admin user-detail signal section |
| `PUT /api/v1/admin/users/{id}/signal-settings` | Admin user-detail per-user toggle |
| `PUT /api/v1/admin/signal-catalog/{kind}` | Admin user-detail catalog tuning |

### `/activity/seen` body shape (BE Phase 2.14)

```ts
interface ActivitySeenRequest {
  refs: { kind: string; subject_type: string; subject_id: string }[];
  hard: boolean;
}
```

> ⚠️ The seen shape changed in Phase 2.14 from
> `{ events: number[], signal: 'soft' | 'hard' }` to the current
> `{ refs, hard }` form. The FE was migrated in Batch 18; the
> [old shape no longer ships](activityFeed.ts).

### Ranking + state model (BE-owned)

- **Ordering** — items are server-ordered by an internal
  `(class, priority, rank_order, magnitude)` tuple. The FE never
  re-sorts; it can filter by `event_class` (Alerts vs
  Notifications) but the relative order within each filter
  preserves the server's.
- **`event_class`** — `notification` (informational; soft-ack on
  view, hard-ack on click; auto-resolves over time) vs `alert`
  (require attention; same ack model but ranked higher; e.g.
  `budget_breached`, `recurring_bill_pending`).
- **`subject_type` + `subject_id`** — drives the deep link. FE
  composes `/bills/:id` / `/budgets#tag-:id` / `/upload-statement`
  / `/recurring` etc. from the pair. Unknown subjects fall
  through to a no-op click but still fire the hard-ack.
- **`system_enabled`** — admin catalog tunable. When false, the
  kind is system-wide off; user-side toggle is read-only.
- **Per-user disable** — overlays the system catalog. If the
  user has disabled a kind in `/account/notifications`, the BE
  won't emit it into their feed.

## Cross-feature seams

- **TopNav** ([`shared/components/TopNav.tsx`](../../src/shared/components/TopNav.tsx))
  mounts `<ActivityBell>` in the right cluster between
  `AccessibilityPopover` and the Help link. `enabled={Boolean(user)}`
  so the bell doesn't render (or fetch) for unauth visitors.
- **Account → Notifications** consumes the user-side signal-settings
  via the shared editor. See [account.md § Notifications](account.md).
- **Admin user-detail** consumes the admin-side signal-settings
  + catalog tunables via the same shared editor.
- **Admin user-detail recent activity** reads the BE's
  per-user activity feed via the A3 detail payload's
  `recent_activity: ActivityItemOut[]` field; no separate
  fetch. The shape matches `ActivityFeedItem`.

## Tests

| File | Covers |
|---|---|
| `shared/components/SignalSettingsEditor.test.tsx` | Kind grouping by domain + label derivation, disabled-list check state, onToggle fires `(kind, enabled)`, user-side cannot toggle `system_enabled=false`, admin-side keeps interactive + AdminTuneRow disclosure, empty-state |
| `features/account/pages/AccountNotificationsPage.test.tsx` | Catalog + disabled list render, toggle PUTs `{kind, enabled}`, "System off" badge + disabled toggle |
| `features/admin/pages/AdminUserDetailPage.test.tsx` (signal section) | Section renders, toggles fire admin PUT, AdminTuneRow surfaces priority / rank / system_enabled |

Dedicated bell + modal + detail-modal test files landed alongside
the notifications-flow rebuild (Batch 20 UAT, `0791964`):
`shared/components/ActivityBell.test.tsx`,
`ActivityFeedModal.test.tsx`, `ActivityDetailModal.test.tsx`. They
cover badge counting + cap, lazy-import on first click, in-place
detail expansion, and per-subject CTA wiring. The TopNav-level
tests (`shared/components/TopNav.test.tsx`) continue to assert the
bell mount.

## History

| BE phase | Commit | What |
|---|---|---|
| **2.4** | `77cffb3` | Activity feed v1 — endpoint + signals + soft/hard ack. FE wired in Platform Batch 7. |
| **2.14** | `ab840be` | Activity engine v2 (registry-driven), per-user signal-settings table + user routes, seen-shape contract change to `{refs, hard}`. |
| **2.16** | `7b0e24b` | Admin operator layer (per-user signal-settings + catalog tunables). T-admin Phase. |
| **FE Platform Batch 18** | `bb900e1` | Dashboard widget removed, TopNav bell + lazy modal landed, `/account/notifications` tab added, `<SignalSettingsEditor>` extracted to shared/, seen-shape drift fixed. |
| **FE Platform Batch 20 UAT** | `0791964` | Notifications-flow rebuild — unseen-count badge wired through, in-place `<ActivityDetailModal>`, per-subject CTA via `activitySubject.ts`. Dedicated test files for Bell + FeedModal + DetailModal. |
