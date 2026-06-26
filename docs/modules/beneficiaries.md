# Beneficiaries feature

> Mirrors `backend/app/modules/beneficiaries`. Owns the merchant +
> person directory transactions are linked to. Lives at
> [`src/features/beneficiaries/`](../../src/features/beneficiaries/).

## Purpose

- Render the `/settings/beneficiaries` list page where users manage
  merchants and people (re-homed under the Settings shell in
  T-nav-ia-reorg). In-app deep-links open it at
  `/settings/beneficiaries?edit=<id>`; the list-page edit modal owns
  the full view + edit + merge surface.
- Drive the alias-uniqueness probe + chip UI that feeds the
  auto-categorization engine.
- Own the `/api/v1/beneficiaries/*` query surface and the merge flow.
- Sync **both** merchant and person category changes by writing through
  the `/api/v1/categorization-rules` endpoint so the beneficiary form can
  set / change / clear a beneficiary's primary tag in one save.

## Pages

| Path                 | Component                                        | Notes                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/settings/beneficiaries` | `pages/BeneficiariesPage.tsx`               | List + filter + modal-first CRUD (Add / Edit / Merge / Delete all live here). Lazy-loaded. The edit modal also opens via the `?edit=<id>` query param (the in-app deep-link contract). System-seeded rows (e.g. `Self`) render a `<SystemChip>` off the `is_system` flag on `Beneficiary` (see conventions.md → System provenance chip). |

The page is composed into the Settings shell as the first sidebar entry
+ `/settings` index default by
[`features/settings/settings.routes.tsx`](../../src/features/settings/settings.routes.tsx)
(`protectedRoutes()` gates the whole `/settings/*` subtree). T-nav-ia-reorg
removed the standalone `features/beneficiaries/beneficiaries.routes.tsx`
(and its old top-level `/beneficiaries` + `/beneficiaries/:id` routes) —
clean replacement, no redirect.

## Components

- `components/AliasChipsInput.tsx` — debounced uniqueness check against
  `/api/v1/beneficiaries/check-alias`; surfaces "checking", "available",
  "taken", "duplicate" states; controlled `aliases[]` value.
- `components/BeneficiaryFormFields.tsx` — shared by the create form
  on the list page and the list-page edit modal. Owns the shared
  `CategoryPicker` (category `SearchableSelect` + assigned-tags editor,
  `fetchTags` from the tags feature) and the merchant↔person type switch.
  Categorization-v2: the `CategoryPicker` now renders for **persons too**
  (full parity — a person can be a landlord → Rent), defaulting to the
  BE's auto-created `Other Transfer` rule; the picker seeds from that rule
  since persons carry their tag only on the rule (no `person.category`).
- `components/BeneficiaryFormDialog.tsx` — unified create / edit modal
  (also reused inline by the categorization-rules page). On creating a
  **person** with a chosen category it syncs the auto-created rule to that
  tag (merchants persist category via the payload; persons have no
  category column, so the FE writes the rule).
- `components/MergeBeneficiariesForm.tsx` — source / target picker
  with swap + mismatched-type warning, mounted inside
  `MergeBeneficiariesDialog` from the list-page edit modal. Source
  / target render as a 2-up grid (stacked below `sm`); Swap +
  Merge buttons share a separate action row so the swap arrow
  never lands between selects on narrow viewports.
- `components/MergeBeneficiariesDialog.tsx` — `<Modal>` wrapper
  around `MergeBeneficiariesForm`, opened from the edit modal's
  Merge action.

## State

No Zustand state. Server-state lives in React Query under
`beneficiaryKeys.{list,detail,relationships}`; every mutation
(create / update / delete / merge) calls
`queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all })`.

## API

[`api/`](../../src/features/beneficiaries/api/)

| File           | Exports                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys.ts`      | `beneficiaryKeys` — `all`, `list()`, `detail(id)`, `relationships()`                                                                                                                                    |
| `aliases.ts`   | `formatAliasesDisplay`, `buildAliasCheckUrl` (pure utilities)                                                                                                                                           |
| `schemas.ts`   | `beneficiaryFormSchema` (Zod), `BeneficiaryFormInput`, `BeneficiaryPayload`, `MergePayload`, `emptyBeneficiaryForm`, `beneficiaryToForm`, `switchBeneficiaryType`, `formToPayload`                      |
| `queries.ts`   | `fetchBeneficiaries`, `fetchBeneficiary`, `fetchRelationships`, `fetchCategorizationRules`, `useBeneficiariesQuery`, `Beneficiary`, `BeneficiaryType`                                                   |
| `mutations.ts` | `createBeneficiaryRequest`, `updateBeneficiaryRequest`, `deleteBeneficiaryRequest`, `mergeBeneficiariesRequest`, `createCategorizationRule`, `updateCategorizationRuleTags`, `deleteCategorizationRule` |

Endpoints touched:

| Method + path                              | Used by                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `GET /api/v1/beneficiaries`                | List page, edit modal (merge picker), beneficiary mutations invalidate |
| `GET /api/v1/beneficiaries/:id`            | Edit modal load                                                        |
| `POST /api/v1/beneficiaries`               | List page inline create                                                |
| `PATCH /api/v1/beneficiaries/:id`          | Edit modal save                                                        |
| `DELETE /api/v1/beneficiaries/:id`         | Edit modal action menu                                                 |
| `POST /api/v1/beneficiaries/merge`         | Edit modal merge form                                                  |
| `GET /api/v1/beneficiaries/check-alias`    | AliasChipsInput (debounced)                                            |
| `GET /api/v1/beneficiaries/relationships`  | Person form's Relationship dropdown                                    |
| `GET /api/v1/categorization-rules`         | Edit modal save (warns on category change) + form field rule-tag sync  |
| `PUT /api/v1/categorization-rules/:uid`    | BeneficiaryFormFields set-primary / remove-rule-tag                    |
| `DELETE /api/v1/categorization-rules/:uid` | BeneficiaryFormFields remove-last-rule-tag                             |

## Responsive

Per [`docs/conventions.md`](../conventions.md):

- The beneficiaries list table scrolls _inside its card_
  (`overflow-x-auto` + `min-w-[28rem]` on the `<table>`) below
  `sm`, so `body` never overflows even when names + alias columns
  would otherwise crowd a phone width.
- `MergeBeneficiariesForm` selects are a 2-up grid that stacks at
  `<sm`; the swap arrow is part of the action row below, not
  sandwiched between selects.
- `Set Primary` on assigned-tag chips is always visible (not
  hover-only) so touch users can reach it.

## Cross-feature seams

- **Imports `fetchTags` + `TagNode`** from `features/tags/api/queries`
  to populate the merchant-category dropdown. Beneficiaries depends
  on tags, not the reverse.
- **Owns categorization-rule mutation helpers** even though the rule
  surface itself lives in `features/categorization/`.
  Rationale: setting a merchant's category from the beneficiary form is
  the canonical write path; the categorization feature owns the rule
  list / filter UI but reuses these mutation helpers.
- **`features/categorization/`** also consumes `formatAliasesDisplay`
  from `features/beneficiaries/api/aliases`.

## Tests

| File                                        | Covers                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/aliases.test.ts`                       | `formatAliasesDisplay`, `buildAliasCheckUrl`                                                                                                      |
| `components/AliasChipsInput.test.tsx`       | Debounced uniqueness check, taken → disabled Add, unique → chip added                                                                             |
| `components/BeneficiaryFormFields.test.tsx` | Field rendering, type switch, category dropdown wiring against `fetchTags`                                                                        |
| `components/BeneficiaryFormDialog.test.tsx` | Modal-first CRUD flow — create + edit + merge entry from the list page                                                                            |
| `pages/BeneficiariesPage.test.tsx`          | List + alias bracket display, search + type filter, end-to-end create with alias check + POST body shape; modal-first edit / delete / merge flows |

All MSW handlers are registered per-test via `server.use(...)` —
the beneficiary endpoints don't yet have permissive defaults in
`src/test/handlers/`; future batches that touch the same endpoints
can promote a shared `beneficiaries.ts` handler if convergence emerges.

## Modal-first CRUD on the list

`BeneficiariesPage.tsx` hosts all CRUD flows as modals over the list:

- **Add** — `+ Add New` button calls `useModal({ urlKey: 'add' }).open()`;
  `?add=true` survives reloads / share-links.
- **Edit / View** — row name + Edit button call
  `useUrlValueModal('edit').openWith(uid)`; `?edit=<uid>` is shareable.
- **Delete** — opens `<ConfirmDialog intent="danger" />` instead of
  `window.confirm()`.
- **Merge / type-switch** — accessible from the edit modal's action
  area; opens `<MergeBeneficiariesDialog>` over the edit modal.
- **In-app payee deep-links** — transaction rows + activity-feed CTAs
  link straight to `/settings/beneficiaries?edit=<id>`, landing on the
  edit modal opened to that record. (T-nav-ia-reorg dropped the old
  `/beneficiaries/:id` → `?edit=` redirect hop in favour of this direct
  target.)

`components/BeneficiaryFormDialog.tsx` is the unified create/edit
dialog.
The categorization rules page consumes it as the inline "Add new
beneficiary" entry point.
