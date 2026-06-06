# Categorization feature

> Mirrors `backend/app/modules/categorization`. Owns the surface that
> manages the beneficiary → tags rules powering the statement upload
> auto-categorizer. Lives at
> [`src/features/categorization/`](../../src/features/categorization/).

## Purpose

- Render `/settings/categorization-rules` inside the
  [Settings shell](settings.md) where users list, add, edit, and
  delete the `beneficiary → tags` rules the backend's
  categorization engine consults.
- Surface the "Re-run categorization" action that re-tags existing
  transactions against the current rule set.
- Own the `/api/v1/categorization-rules` query / cache key namespace.

## Pages

| Path                             | Component                           | Notes                                       |
| -------------------------------- | ----------------------------------- | ------------------------------------------- |
| `/settings/categorization-rules` | `pages/CategorizationRulesPage.tsx` | Mounted by the settings shell. Lazy-loaded. |

The CategorizationRulesPage is registered by
[`features/settings/settings.routes.tsx`](../../src/features/settings/settings.routes.tsx)
as a child of `/settings`. The legacy top-level `/categorization-rules`
URL was retired in Batch 9 — see
[`docs/modules/settings.md`](settings.md).

## Rule-name conventions

The auto-generated rule name renders progressively in the form:

- No beneficiary selected → italic placeholder
- Beneficiary picked, no tags → just `${beneficiary}` (the name
  surfaces as soon as the beneficiary is chosen)
- Beneficiary + ≥ 1 tag → `${beneficiary} -> ${primary}` — uses
  **only** the primary tag (index 0 of `tag_ids`), regardless of
  how many tags are selected. Promoting a different tag via
  `Set Primary` (or removing the primary chip so another auto-
  promotes) updates the rule name in place.

Backend invariant: `tag_ids[0]` is **always** the primary — the
taxation engine derives `txn_type` from it. Removing the primary
chip while other tags remain is safe: the next tag in `tag_ids`
shifts to index 0 and becomes the new primary. The page never
allows a rule to enter a "no primary" state — the only way to drop
all primaries is to remove every tag, which is the same as
deleting the rule.

## Components

- `pages/CategorizationRulesPage.tsx` — page-level surface with
  header, "Re-run categorization" action, beneficiary search and
  the grouped existing-rules list. The form itself lives in the
  modal below.
- `components/CategorizationRuleFormDialog.tsx` — `<Modal size="lg">`
  wrapping the rule form (beneficiary search dropdown, tag chip
  editor with `Set Primary` + remove affordances, auto-generated
  rule-name preview). The "+ Add new beneficiary" CTA inside the
  beneficiary search opens
  `features/beneficiaries/components/BeneficiaryFormDialog.tsx`
  nested inside this dialog.
- `components/GroupedRulesList.tsx` — bucketed rule renderer.
  Single-rule groups render as the full rule card; multi-rule
  groups render as a collapsible header (chip row + count) with
  compact per-rule rows when expanded.

## Rule grouping

Rules with the **same set of `tag_ids`** (order-insensitive) bucket
into one group:

- **Group key:** sorted-dedup'd `tag_ids` joined with `,`. `[12, 15]`
  and `[15, 12]` share the same group key.
- **Single-rule groups** render as a plain rule card — no added
  chrome for the simple case.
- **Multi-rule groups** collapse by default. Header shows the
  tag chips + "Applied to N beneficiaries" + chevron; expanded
  renders compact per-rule rows (beneficiary name + aliases +
  primary chip + Edit/Delete).
- **Representative primary in the collapsed header** is chosen by
  `chooseRepresentativePrimary(rules, flatTags)`:
  1. Count how many rules in the group list each tag as their
     primary (position 0 in `tag_ids`).
  2. The tag with the highest count wins.
  3. Ties: if all tied tags share a parent, render the parent
     instead (caller gets `isParentFallback: true` so it can label
     the chip without the child suffix).
  4. No shared parent → pick the smallest tag id deterministically.
- **Group sort:** single-rule groups first, multi-rule groups
  after; alphabetical by representative tag name within each band.
  The singletons-first ordering gives a cleaner visual rhythm
  (rows that look identical sit together; the condensed cluster
  sits below).
- **Section sub-headings:** "Standalone rules (N)" and "Grouped
  rules (N)" render whenever the corresponding band has entries —
  independent of whether the other band exists. Even a
  seed-data-only page (mostly singletons) gets the anchor.
- **"Show N more" disclosure caps:** 5 singletons + 6 groups
  visible by first paint. The asymmetry is intentional: each
  singleton card costs ~140px to render one rule, while a
  collapsed group card costs ~80px to represent N rules — so
  singletons are ~4–7× costlier per rule and get the tighter cap.
  Beyond the cap, a dashed-border button expands the band;
  clicking again collapses back. Caps live in
  `components/GroupedRulesList.tsx` as `SINGLETON_VISIBLE_CAP` +
  `GROUP_VISIBLE_CAP` — bump in place if usage proves the
  defaults too tight.
- **Rules within a group:** alphabetical by `beneficiary_name`.

On save, the page auto-expands the destination group and applies a
brief indigo ring (~1.5 s) to the saved rule row so the user can
see where the rule landed — useful when an edit shifts a rule
between groups.

## Add new beneficiary inline

The beneficiary search dropdown has an `＋ Add new beneficiary`
CTA pinned at the top. Click → opens
`features/beneficiaries/components/BeneficiaryFormDialog.tsx`
(the shared create / edit modal). The Name field pre-fills from
whatever's in the search box.

On success, the dialog closes, the page refetches
`/api/v1/beneficiaries`, and the rule form's beneficiary fields
auto-select to the newly-created entry. The user's in-flight rule
state (tags, notes, etc.) survives untouched.

## Responsive

Per [`docs/conventions.md`](../conventions.md):

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

| File           | Exports                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `keys.ts`      | `categorizationKeys` — `all`, `rules()`, `rulesList()`                                                         |
| `schemas.ts`   | `CategorizationRulePayload` (full PUT / POST body shape)                                                       |
| `queries.ts`   | `fetchCategorizationRules`, `useCategorizationRulesQuery`, `CategorizationRule`, `CategorizationRulesResponse` |
| `mutations.ts` | `updateCategorizationRuleRequest` (full PUT), `reRunCategorizationRequest`                                     |
| `ruleUtils.ts` | `flattenTags`, `formatTagAssignment`, `buildRuleName`, `FlatTag`                                               |
| `grouping.ts`  | `tagSetKey`, `chooseRepresentativePrimary`, `groupRules`, `RuleGroup`                                          |

Endpoints touched:

| Method + path                              | Used by                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/categorization-rules`         | `useCategorizationRulesQuery`                                                                                                                             |
| `POST /api/v1/categorization-rules`        | Page create form via `createCategorizationRule` (owned by beneficiaries)                                                                                  |
| `PUT /api/v1/categorization-rules/:uid`    | Page update form (full body) via `updateCategorizationRuleRequest`; chip-level promote/remove via `updateCategorizationRuleTags` (owned by beneficiaries) |
| `DELETE /api/v1/categorization-rules/:uid` | Page delete + last-tag-removal flow via `deleteCategorizationRule` (owned by beneficiaries)                                                               |
| `POST /api/v1/categorization-rules/re-run` | `reRunCategorizationRequest`                                                                                                                              |
| `GET /api/v1/tags`                         | Page reference data (via `fetchTags` from `features/tags/api/queries`)                                                                                    |
| `GET /api/v1/beneficiaries`                | Page reference data (via `fetchBeneficiaries` from `features/beneficiaries/api/queries`)                                                                  |
| `GET /api/v1/metadata/constants`           | `fetchTagConstants` — surfaces `SYSTEM_USER_ID`, `TOTAL_TAG_ID`, `MISCELLANEOUS_TAG_ID`                                                                   |

## Cross-feature seams

- **`features/beneficiaries/api/mutations.ts`** owns the write
  helpers (`createCategorizationRule`,
  `updateCategorizationRuleTags`, `deleteCategorizationRule`) so the
  beneficiary form can fire them without reaching back into
  categorization. This page imports them rather than relocating —
  rule writes belong to the form that owns the beneficiary, not the
  rules list. The full-payload PUT
  (`updateCategorizationRuleRequest`) lives here because only the
  rules form uses it.
- **`features/tags/api/queries.ts`** owns `fetchTags` and
  `fetchTagConstants` — same single-source rationale.
- **`features/beneficiaries/api/aliases.ts`** owns
  `formatAliasesDisplay`, reused by the rule card to render
  alias suffixes.

## Tests

| File                                     | Covers                                                                                                                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/CategorizationRulesPage.test.tsx` | Singleton rules render + alias suffixes, Edit / Delete affordance per row, create-rule end-to-end with auto-generated name, delete confirms + hits the API, multi-rule group collapses + expands, add-beneficiary dialog opens from the dropdown CTA + pre-fills Name |
| `api/ruleUtils.test.ts`                  | `flattenTags`, `formatTagAssignment`, `buildRuleName`                                                                                                                                                                                                                 |
| `api/grouping.test.ts`                   | `tagSetKey` (order/dedupe invariance), `chooseRepresentativePrimary` (unique winner, shared-parent fallback, no-shared-parent fallback to smallest id), `groupRules` (bucketing, group sort, within-group sort)                                                       |

MSW handlers for `/api/v1/categorization-rules`, `/api/v1/tags`,
`/api/v1/beneficiaries`, `/api/v1/metadata/constants` live in the test
file's `beforeEach`; per-test overrides via `server.use(...)`.

## Follow-ups

- Add-beneficiary-inline and rule grouping both shipped. No
  outstanding follow-ups on this feature surface.

## Modal-first CRUD

The inline form on `CategorizationRulesPage.tsx` is mounted
inside a `<Modal size="lg">` ("Add categorization rule" / "Edit
categorization rule"). Add and Edit reuse the same form state
machine. Delete opens `<ConfirmDialog intent="danger" />` instead
of `window.confirm()`. The grouped rules list itself stays inline.
The "+ Add new beneficiary" CTA in the beneficiary search dropdown
now opens `BeneficiaryFormDialog` (replaces the legacy
`CreateBeneficiaryDialog`).
