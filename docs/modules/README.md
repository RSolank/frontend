# Per-feature module docs

Each feature batch (2–8) drops a page here mirroring the backend's
per-module docs at [`backend/docs/modules/`](../../../backend/docs/modules/).
Folder is empty during Batch 0.

| Batch | Feature page that lands |
|---|---|
| 2 | `auth.md` |
| 3 | `users.md`, `metadata.md` |
| 4 | `tags.md`, `beneficiaries.md` |
| 5 | `transactions.md` (covers `statement_upload/` subfolder) |
| 6 | `categorization.md` |
| 7 | `taxation.md` |
| 8 | `budgets.md` |

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
