# Beneficiaries feature

> Mirrors `backend/app/modules/beneficiaries`. Owns the merchant +
> person directory transactions are linked to. Lives at
> [`src/features/beneficiaries/`](../../src/features/beneficiaries/).

## Purpose

- Render the `/beneficiaries` list and `/beneficiaries/:id` detail
  pages where users manage merchants and people.
- Drive the alias-uniqueness probe + chip UI that feeds the
  auto-categorization engine.
- Own the `/api/beneficiaries/*` query surface and the merge flow.
- Sync merchant → category changes by writing through the
  `/api/categorization-rules` endpoint so the beneficiary form can
  set / change / clear a merchant's primary tag in one save.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/beneficiaries` | `pages/BeneficiariesPage.tsx` | List + filter + inline create form. Lazy-loaded. |
| `/beneficiaries/:id` | `pages/BeneficiaryDetailPage.tsx` | Read-only by default; Edit toggles the form + the merge consolidator. Lazy-loaded. |

Routes are exported from
[`features/beneficiaries/beneficiaries.routes.tsx`](../../src/features/beneficiaries/beneficiaries.routes.tsx)
and composed into the root router by `src/app/routes.tsx`
(`protectedRoutes()` wraps both).

## Components

- `components/AliasChipsInput.tsx` — debounced uniqueness check against
  `/api/beneficiaries/check-alias`; surfaces "checking", "available",
  "taken", "duplicate" states; controlled `aliases[]` value.
- `components/BeneficiaryFormFields.tsx` — shared by the create form
  on the list page and the edit form on the detail page. Owns the
  category + assigned-tags editor (uses `fetchTags` from the tags
  feature) and the merchant↔person type switch.
- `components/MergeBeneficiariesForm.tsx` — source / target picker
  with swap + mismatched-type warning, used on the detail page in
  edit mode. Source / target render as a 2-up grid (stacked below
  `sm`); Swap + Merge buttons share a separate action row so the
  swap arrow never lands between selects on narrow viewports.

## State

No Zustand state. Server-state lives in React Query under
`beneficiaryKeys.{list,detail,relationships}`; every mutation
(create / update / delete / merge) calls
`queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all })`.

## API

[`api/`](../../src/features/beneficiaries/api/)

| File | Exports |
|---|---|
| `keys.ts` | `beneficiaryKeys` — `all`, `list()`, `detail(id)`, `relationships()` |
| `aliases.ts` | `formatAliasesDisplay`, `buildAliasCheckUrl` (pure utilities) |
| `schemas.ts` | `beneficiaryFormSchema` (Zod), `BeneficiaryFormInput`, `BeneficiaryPayload`, `MergePayload`, `emptyBeneficiaryForm`, `beneficiaryToForm`, `switchBeneficiaryType`, `formToPayload` |
| `queries.ts` | `fetchBeneficiaries`, `fetchBeneficiary`, `fetchRelationships`, `fetchCategorizationRules`, `useBeneficiariesQuery`, `Beneficiary`, `BeneficiaryType` |
| `mutations.ts` | `createBeneficiaryRequest`, `updateBeneficiaryRequest`, `deleteBeneficiaryRequest`, `mergeBeneficiariesRequest`, `updateCategorizationRuleTags`, `deleteCategorizationRule` |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/beneficiaries` | List page, detail page (merge picker), beneficiary mutations invalidate |
| `GET /api/beneficiaries/:id` | Detail page load |
| `POST /api/beneficiaries` | List page inline create |
| `PATCH /api/beneficiaries/:id` | Detail page save |
| `DELETE /api/beneficiaries/:id` | Detail page action menu |
| `POST /api/beneficiaries/merge` | Detail page merge form |
| `GET /api/beneficiaries/check-alias` | AliasChipsInput (debounced) |
| `GET /api/beneficiaries/relationships` | Person form's Relationship dropdown |
| `GET /api/categorization-rules` | Detail page save (warns on category change) + form field rule-tag sync |
| `PUT /api/categorization-rules/:uid` | BeneficiaryFormFields set-primary / remove-rule-tag |
| `DELETE /api/categorization-rules/:uid` | BeneficiaryFormFields remove-last-rule-tag |

## Responsive

Per CONTRIBUTING.md §6:

- The beneficiaries list table scrolls *inside its card*
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
  surface itself moves to `features/categorization/` in Batch 6.
  Rationale: setting a merchant's category from the beneficiary form
  is the canonical write path. Batch 6 will manage the rule list /
  filter UI but will reuse these mutation helpers.
- **`features/categorization/` (Batch 6 will land)** already consumes
  `formatAliasesDisplay` from `features/beneficiaries/api/aliases`
  (CategorizationRulesTab updated mid-Batch-4 to follow the
  refactor).

## Tests

| File | Covers |
|---|---|
| `api/aliases.test.ts` | `formatAliasesDisplay`, `buildAliasCheckUrl` |
| `components/AliasChipsInput.test.tsx` | Debounced uniqueness check, taken → disabled Add, unique → chip added |
| `pages/BeneficiariesPage.test.tsx` | List + alias bracket display, search + type filter, end-to-end create with alias check + POST body shape |
| `pages/BeneficiaryDetailPage.test.tsx` | Read-only render, edit-mode merge form + alias add, type switch carries shared fields, type-mismatch merge warning |

All MSW handlers are registered per-test via `server.use(...)` —
the beneficiary endpoints don't yet have permissive defaults in
`src/test/handlers/`; future batches that touch the same endpoints
can promote a shared `beneficiaries.ts` handler if convergence emerges.
