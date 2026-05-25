# Categorization feature

> Mirrors `backend/app/modules/categorization`. Owns the surface that
> manages the beneficiary → tags rules powering the statement upload
> auto-categorizer. Lives at
> [`src/features/categorization/`](../../src/features/categorization/).

## Purpose

- Render the standalone `/categorization-rules` page where users
  list, add, edit, and delete the `beneficiary → tags` rules the
  backend's categorization engine consults.
- Surface the "Re-run categorization" action that re-tags existing
  transactions against the current rule set.
- Own the `/api/categorization-rules` query / cache key namespace.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/categorization-rules` | `pages/CategorizationRulesPage.tsx` | Lazy-loaded via `categorization.routes.tsx`. |

Routes are exported from
[`features/categorization/categorization.routes.tsx`](../../src/features/categorization/categorization.routes.tsx)
and composed into the root router by `src/app/routes.tsx`
(`<CategorizationRulesPage>` is wrapped by `protectedRoutes()`).

Before Batch 6 this surface lived as a tab inside `/settings`. The
extraction matches the Batch 4 pattern (`CategoriesTab → /categories`)
so each rule set is a first-class route with its own bundle. `/settings`
now hosts only the taxation tab until Batch 7 extracts that too.

## Components

- `pages/CategorizationRulesPage.tsx` — full standalone page with
  header, create / update form, beneficiary search dropdown, tag
  chip editor (with `Set Primary` + remove affordances), and the
  existing-rules list. Tailwind-styled with dark-mode parity.

## Responsive

Per CONTRIBUTING.md §6:

- Page + section headers use `flex-wrap items-start gap-3` so the
  title block, back link, and CTA reflow gracefully on phones.
- The tag select + Add button row uses `flex-wrap gap-2 sm:flex-nowrap`
  so on `<sm` the Add button drops under the select instead of
  squeezing it.
- Tag chips inside the form pad and the existing-rule list use
  `flex-wrap` so long chip rows wrap inside their container.
- Rule cards use `flex-wrap items-start justify-between gap-2` for
  the title + Edit/Delete row so the action buttons fall under long
  rule names on narrow widths.
- Section cards use `p-4 sm:p-6` padding.

## State

No Zustand state. Server-state lives in React Query under
`categorizationKeys.rules()`; mutations call
`queryClient.invalidateQueries({ queryKey: categorizationKeys.rules() })`
so the rule list refreshes after a write.

## API

[`api/`](../../src/features/categorization/api/)

| File | Exports |
|---|---|
| `keys.ts` | `categorizationKeys` — `all`, `rules()`, `rulesList()` |
| `schemas.ts` | `CategorizationRulePayload` (full PUT / POST body shape) |
| `queries.ts` | `fetchCategorizationRules`, `useCategorizationRulesQuery`, `CategorizationRule`, `CategorizationRulesResponse` |
| `mutations.ts` | `updateCategorizationRuleRequest` (full PUT), `reRunCategorizationRequest` |
| `ruleUtils.ts` | `flattenTags`, `formatTagAssignment`, `buildRuleName`, `FlatTag` |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/categorization-rules` | `useCategorizationRulesQuery` |
| `POST /api/categorization-rules` | Page create form via `createCategorizationRule` (owned by beneficiaries) |
| `PUT /api/categorization-rules/:uid` | Page update form (full body) via `updateCategorizationRuleRequest`; chip-level promote/remove via `updateCategorizationRuleTags` (owned by beneficiaries) |
| `DELETE /api/categorization-rules/:uid` | Page delete + last-tag-removal flow via `deleteCategorizationRule` (owned by beneficiaries) |
| `POST /api/categorization-rules/re-run` | `reRunCategorizationRequest` |
| `GET /api/tags` | Page reference data (via `fetchTags` from `features/tags/api/queries`) |
| `GET /api/beneficiaries` | Page reference data (via `fetchBeneficiaries` from `features/beneficiaries/api/queries`) |
| `GET /api/metadata/constants` | `fetchTagConstants` — surfaces `SYSTEM_USER_ID`, `TOTAL_TAG_ID`, `MISCELLANEOUS_TAG_ID` |

## Cross-feature seams

- **`features/beneficiaries/api/mutations.ts`** owns the write
  helpers (`createCategorizationRule`,
  `updateCategorizationRuleTags`, `deleteCategorizationRule`) so the
  beneficiary form can fire them without reaching back into
  categorization. This page imports them rather than relocating —
  rule writes belong to the form that owns the beneficiary, not the
  rules list (Batch 4 note 2; Batch 5 note 7). The full-payload PUT
  (`updateCategorizationRuleRequest`) lives here because only the
  rules form uses it.
- **`features/tags/api/queries.ts`** owns `fetchTags` and
  `fetchTagConstants` — same single-source rationale.
- **`features/beneficiaries/api/aliases.ts`** owns
  `formatAliasesDisplay`, reused by the rule card to render
  alias suffixes.

## Tests

| File | Covers |
|---|---|
| `pages/CategorizationRulesPage.test.tsx` | Rule list renders + alias suffixes, Edit / Delete affordance per row, create-rule end-to-end with auto-generated name, delete confirms + hits the API |
| `api/ruleUtils.test.ts` | `flattenTags`, `formatTagAssignment`, `buildRuleName` |

MSW handlers for `/api/categorization-rules`, `/api/tags`,
`/api/beneficiaries`, `/api/metadata/constants` live in the test
file's `beforeEach`; per-test overrides via `server.use(...)`.

## Follow-ups

- **"+ Add new beneficiary" CTA in the dropdown is a shell stub.**
  Click handler is `handleAddNewBeneficiary` in
  `pages/CategorizationRulesPage.tsx` — currently `console.warn` +
  `TODO(batch-6-followup)`. The mechanism (popup-window vs same-tab
  nav with `?return=` + `?select=` query plumbing vs in-page
  `<Dialog>` reusing
  `features/beneficiaries/components/BeneficiaryFormFields.tsx`)
  and the target URL are deferred to a dedicated session. The
  shell + styling already lands so the wiring is the only piece
  left.
