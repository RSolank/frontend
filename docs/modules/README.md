# Per-feature module docs

One page per feature, mirroring the backend's per-module docs at
[`backend/docs/modules/`](../../../backend/docs/modules/). Cross-stack
readers should be able to open the page on either side and map it
1:1 to the other.

## Table of contents

- [`auth.md`](auth.md) — login / register / session handling.
- [`users.md`](users.md) — user profile + preferences side of the
  account surface.
- [`metadata.md`](metadata.md) — read-only reference data
  (countries, currencies, timezones).
- [`tags.md`](tags.md) — hierarchical tags + tag types + aliases.
- [`beneficiaries.md`](beneficiaries.md) — merchants + people, with
  merge flow.
- [`transactions.md`](transactions.md) — list + calendar + statement
  upload (`statement_upload/` subfolder).
- [`categorization.md`](categorization.md) — rules, grouped rule
  list, beneficiary→tag pipeline.
- [`taxation.md`](taxation.md) — rules + bills + tax tracker page.
- [`budgets.md`](budgets.md) — budget limits + expense tracker.
- [`dashboard.md`](dashboard.md) — landing surface, cross-feature
  widgets.
- [`account.md`](account.md) — settings shell + account preferences
  page.
- [`settings.md`](settings.md) — settings layout shell + breadcrumb
  + sidebar.

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
