# Per-feature module docs

One page per feature, mirroring the backend's per-module docs at
[`backend/docs/modules/`](../../../backend/docs/modules/). Cross-stack
readers should be able to open the page on either side and map it
1:1 to the other.

## Table of contents

- [`auth.md`](auth.md) — login / register / session handling.
- [`users.md`](users.md) — user profile + preferences side of the
  account surface.
- [`metadata.md`](metadata.md) — **no longer a feature.** The read-only
  reference data (countries / currencies) + the Country/Currency/Timezone
  pickers were dissolved into `shared/` (infra, not a feature):
  `shared/api/referenceData.ts` + `shared/components/*Select.tsx`. Page
  kept as a pointer.
- [`tags.md`](tags.md) — hierarchical tags + tag types + aliases.
- [`beneficiaries.md`](beneficiaries.md) — merchants + people, with
  merge flow.
- [`transactions.md`](transactions.md) — list + calendar + statement
  upload (`statement_upload/` subfolder).
- [`categorization.md`](categorization.md) — rules, grouped rule
  list, beneficiary→tag pipeline.
- [`taxation.md`](taxation.md) — rules + bills + tax tracker page.
- [`budgets.md`](budgets.md) — budget limits + expense tracker.
- [`recurring.md`](recurring.md) — recurring-transaction inference
  engine surface (`/recurring` management page + dashboard
  upcoming-bills widget).
- [`bank-accounts.md`](bank-accounts.md) — user bank accounts +
  identifier sub-resource (`/settings/bank-accounts` CRUD,
  tax-pot designation, optional picker on manual transaction
  forms).
- [`dashboard.md`](dashboard.md) — landing surface, cross-feature
  widgets.
- [`account.md`](account.md) — `/account/*` shell (profile,
  security, privacy, accessibility, preferences, notifications) —
  six sections, shared sidebar.
- [`settings.md`](settings.md) — settings layout shell + breadcrumb
  - sidebar.
- [`admin.md`](admin.md) — operator-only `/admin/*` surface
  (T-admin A1–E1: users list + detail, lock/unlock, force-logout,
  cemetery audit, bill backfill, signal controls).
- [`activity.md`](activity.md) — **shared-side cross-cutting
  surface** (not a feature). TopNav bell + lazy modal, the
  user-side `/account/notifications` tab, the admin user-detail
  signal section, and the shared `<SignalSettingsEditor>`. Bell +
  modal + editor + activity API all live in `shared/`. Page kept
  here for cross-stack-reader parity with the BE's `backend/docs/modules/activity*`.

## Page outline

Each page follows the same outline so cross-stack readers can map it
to the backend equivalent:

- **Purpose** — one paragraph mirroring the backend module's purpose.
- **Pages** — routes mounted, with file references.
- **Components** — UI primitives scoped to the feature.
- **Hooks** — feature-specific hooks built on top of `api/`.
- **API** — `queries.ts`, `mutations.ts`, `keys.ts`, `schemas.ts`
  contents and what they map to backend-side.
- **State** — Zustand stores (if any) and what crosses pages.
- **Tests** — what's covered, where the MSW handlers live, gaps.
