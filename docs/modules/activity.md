# Activity surface

> Cross-feature activity feed — backend-originated worker / engine
> events surfaced through the TopNav bell, the user-side
> `/account/notifications` tab, and the admin user-detail page.
> Lives **shared/-side** at
> [`src/shared/api/activity*`](../../src/shared/api/) +
> [`src/shared/components/Activity*`](../../src/shared/components/)
>
> - [`src/shared/components/SignalSettingsEditor.tsx`](../../src/shared/components/SignalSettingsEditor.tsx).

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
  outrank Notifications in the same surface; inside each section the
  bell clusters items by `domain` under sub-headers (Strategy A) while
  preserving BE rank-order (clusters, never re-sorts).
- Surface a 3-state acknowledgement model — UNSEEN → soft-acked
  (rendered) → hard-acked (clicked). The BE owns dedupe; the FE
  fires the seen mutations.
- Give users per-kind enable/disable control over the feed via
  `/account/notifications`; give admins per-user disable + system-
  wide priority / rank / system_enabled tunables via the admin
  user-detail page.

## Surfaces

Lives across several FE consumers; the contract is one BE-side
endpoint set:

| Surface                                                                                                                                                                      | What it renders                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Owner                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **TopNav bell** — [`shared/components/ActivityBell.tsx`](../../src/shared/components/ActivityBell.tsx)                                                                       | Lazy-loaded modal trigger. Badge counts UNSEEN items across both classes with a "5+" cap. Lives on every authenticated page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | App shell                                |
| **Activity feed modal** — [`shared/components/ActivityFeedModal.tsx`](../../src/shared/components/ActivityFeedModal.tsx)                                                     | Lazy chunk imported by the bell on first click. Renders Alerts section, then Notifications section, in the same modal (not tabs), each clustered by `domain` under sub-headers (Strategy A — see `groupByDomain`). Capped at 10 items total; the split + ordering are BE rank-driven (the FE clusters but never re-sorts). Soft-acks on render (once per `event_id` per session via `SEEN_THIS_SESSION` set), hard-acks on row click — row click now opens **`<ActivityDetailModal>` in place** (Batch 20 UAT, `0791964`) rather than full-page deep-linking, with per-subject CTAs surfaced inside. "All clear — nothing new" empty state. "Manage notifications →" footer link to `/account/notifications`. | App shell                                |
| **Activity detail modal** — [`shared/components/ActivityDetailModal.tsx`](../../src/shared/components/ActivityDetailModal.tsx)                                               | In-place expansion of a single activity row. Hosts the per-subject CTAs derived from [`shared/utils/activitySubject.ts`](../../src/shared/utils/activitySubject.ts) (`subjectMeta()` maps each `subject_type` → CTA label + deep-link target). Replaces the prior full-page-navigation pattern so users stay in the feed context.                                                                                                                                                                                                                                                                       | App shell                                |
| **User Notifications tab** — [`features/account/pages/AccountNotificationsPage.tsx`](../../src/features/account/pages/AccountNotificationsPage.tsx)                          | Per-kind enable/disable for the user's own feed. Renders the shared `<SignalSettingsEditor viewerRole="user">`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | [account.md](account.md) § Notifications |
| **Admin user-detail signal section** — `<SignalSettingsSection>` in [`features/admin/pages/AdminUserDetailPage.tsx`](../../src/features/admin/pages/AdminUserDetailPage.tsx) | Per-user disable for the admin'd account + system-wide catalog tunables (priority / rank_order / system_enabled). Renders the shared `<SignalSettingsEditor viewerRole="admin">` with `onTune` wired.                                                                                                                                                                                                                                                                                                                                                                                                   | [admin.md](admin.md) § Pages             |
| **Dashboard callouts (B1)** — `<ActivityCallout>` inside `OverdueBillsWidget` + the `TaxTrackerCard` tax-mode banner                                                        | Targeted per-card enrichment: a domain-scoped slice (`useDomainActivityQuery('taxation')`) spliced into a card for the _additive_ signals only (`bill_overdue`, `tax_mode_auto_disabled`). Each `<ActivityCallout>` reuses `iconForKind` + `priorityTone*` + `subjectMeta`, and **hard-acks on dismiss only** — the bell remains the sole soft-ack owner. See [dashboard.md](dashboard.md).                                                                                                                                                                                                              | [dashboard.md](dashboard.md)             |

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

Within each section, items are clustered by `domain` under a
sub-header via [`groupByDomain`](../../src/shared/utils/activityDomain.ts)
(T-nav-ia-reorg, **Strategy A**): domain groups appear in the order of
each domain's highest-ranked member (its first appearance in the
rank-ordered slice) and items inside a group keep their BE order. This
**clusters** the existing order under headers — it never re-sorts, so the
BE rank order (`magnitude` + `rank_order` + `priority`, server-resolved)
is preserved as far as a contiguous grouping allows. `domainLabel` maps
the raw domain to a friendly header (curated for the 7 known domains,
title-cased fallback otherwise). Section headers (and domain sub-headers)
render only when non-empty; "All clear — nothing new" renders when both
sections are empty.

> Domain grouping is what let the **Recurring** page leave the MAIN nav
> row (T-nav-ia-reorg): its upcoming/pending bills already arrive as
> `recurring`-domain signals and now surface under a "Recurring" header,
> with the full forecast a click away under `/settings/recurring`. The
> 7-day / weekly-refresh / authorized-templates-only limits of those
> signals are accepted, since the live forecast lives on the page.
>
> Note: `SignalSettingsEditor` keeps its **own** older `DOMAIN_LABELS`
> map (keyed `tax`/`budget`/`auth`, not the registry's
> `taxation`/`budgets`/…), so the two are not yet unified — see the
> follow-up note in the task log.

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

The kind→icon map was extracted out of this modal into
[`shared/utils/activityIcon.ts`](../../src/shared/utils/activityIcon.ts)
(`iconForKind`) in B1 so the dashboard callouts import the same
mapping rather than forking it (a locked invariant — "import, don't
fork"). Unknown kinds fall back to `Bell`.

### `ActivityCallout` (`shared/components/ActivityCallout.tsx`) — B1

Inline, dismissible activity row for the dashboard cards. Renders
one feed item: `iconForKind` glyph tinted by `priorityToneClass`,
the BE-authored `summary`, an optional `subjectMeta` deep-link, and
a dismiss `×`. **Dismiss hard-acks** (`POST /activity/seen {refs,
hard: true}` via `useMarkActivitySeenMutation`); the mutation
invalidates `feedAll()` so the row drops on the next domain-feed
refetch. Per the BE Law a hard-ack MUTEs an alert (resurfaces later)
or DELETEs a notification. Unlike the bell, these callouts **never
soft-ack on render** — the bell stays the sole soft-ack owner, so a
card surfacing an item doesn't silently mark it seen.

`OverdueBillsWidget` (`features/dashboard/`) and the `TaxTrackerCard`
tax-mode banner are the two consumers; both pull one shared
`useDomainActivityQuery('taxation')` fetch (deduped by react-query)
and filter client-side to the kind they care about.

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

| File                 | Exports                                                                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activityKeys.ts`    | `activityKeys` — `all`, `feed(limit)`, `feedByDomain(domain, limit)`, `catalog()`, `signalSettings()`, `adminUserSignalSettings(userId)`                                                                                                                              |
| `activityFeed.ts`    | `ActivityFeedItem` shape, `ActivitySeenRef` + `ActivitySeenRequest`, `fetchActivityFeed(limit, domain?)`, `markActivitySeen`, `itemsToSeenRefs`, `useActivityFeedQuery(limit, enabled)`, `useDomainActivityQuery(domain, limit, enabled)` (B1), `useUserSignalSettingsQuery(enabled)`, plus the user-side signal-settings GET / PUT helpers |
| `activityCatalog.ts` | `CatalogEntry` + `CatalogResponse` types, `useActivityCatalogQuery`, `buildEventClassIndex(catalog)` (Map<kind, event_class>)                                                                                                                                        |
| `activityIcon.ts`    | `iconForKind(kind)` (B1) — shared kind→Lucide-icon map, `Bell` fallback; consumed by the bell modal + dashboard callouts                                                                                                                                             |

Endpoints touched:

| Method + path                                  | Used by                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /api/v1/activity?limit=N`                 | Activity feed modal — list of items, server-ordered                                          |
| `GET /api/v1/activity?limit=N&domain=<str>`    | B1 dashboard callouts (`useDomainActivityQuery`) — same reader path + `disabled[]` filter, scoped to one domain; 404s on an unknown domain |
| `POST /api/v1/activity/seen`                   | Soft + hard acks (body shape below)                                                          |
| `GET /api/v1/activity/catalog`                 | Activity feed modal (event_class split) + SignalSettingsEditor (kind list + domain grouping) |
| `GET /api/v1/activity/signal-settings`         | Account → Notifications                                                                      |
| `PUT /api/v1/activity/signal-settings`         | Account → Notifications toggle                                                               |
| `GET /api/v1/admin/users/{id}/signal-settings` | Admin user-detail signal section                                                             |
| `PUT /api/v1/admin/users/{id}/signal-settings` | Admin user-detail per-user toggle                                                            |
| `PUT /api/v1/admin/signal-catalog/{kind}`      | Admin user-detail catalog tuning                                                             |

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
  - catalog tunables via the same shared editor.
- **Admin user-detail recent activity** reads the BE's
  per-user activity feed via the A3 detail payload's
  `recent_activity: ActivityItemOut[]` field; no separate
  fetch. The shape matches `ActivityFeedItem`.

## Tests

| File                                                                 | Covers                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/components/SignalSettingsEditor.test.tsx`                    | Kind grouping by domain + label derivation, disabled-list check state, onToggle fires `(kind, enabled)`, user-side cannot toggle `system_enabled=false`, admin-side keeps interactive + AdminTuneRow disclosure, empty-state |
| `features/account/pages/AccountNotificationsPage.test.tsx`           | Catalog + disabled list render, toggle PUTs `{kind, enabled}`, "System off" badge + disabled toggle                                                                                                                          |
| `features/admin/pages/AdminUserDetailPage.test.tsx` (signal section) | Section renders, toggles fire admin PUT, AdminTuneRow surfaces priority / rank / system_enabled                                                                                                                              |

Dedicated bell + modal + detail-modal test files landed alongside
the notifications-flow rebuild (Batch 20 UAT, `0791964`):
`shared/components/ActivityBell.test.tsx`,
`ActivityFeedModal.test.tsx`, `ActivityDetailModal.test.tsx`. They
cover badge counting + cap, lazy-import on first click, in-place
detail expansion, and per-subject CTA wiring. The TopNav-level
tests (`shared/components/TopNav.test.tsx`) continue to assert the
bell mount.

## History

| BE phase                     | Commit    | What                                                                                                                                                                                                |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.4**                      | `77cffb3` | Activity feed v1 — endpoint + signals + soft/hard ack. FE wired in Platform Batch 7.                                                                                                                |
| **2.14**                     | `ab840be` | Activity engine v2 (registry-driven), per-user signal-settings table + user routes, seen-shape contract change to `{refs, hard}`.                                                                   |
| **2.16**                     | `7b0e24b` | Admin operator layer (per-user signal-settings + catalog tunables). T-admin Phase.                                                                                                                  |
| **FE Platform Batch 18**     | `bb900e1` | Dashboard widget removed, TopNav bell + lazy modal landed, `/account/notifications` tab added, `<SignalSettingsEditor>` extracted to shared/, seen-shape drift fixed.                               |
| **FE Platform Batch 20 UAT** | `0791964` | Notifications-flow rebuild — unseen-count badge wired through, in-place `<ActivityDetailModal>`, per-subject CTA via `activitySubject.ts`. Dedicated test files for Bell + FeedModal + DetailModal. |
