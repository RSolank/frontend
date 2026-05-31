# Tags feature

> Mirrors `backend/app/modules/tags`. Owns the hierarchical category
> tree the user picks from when categorizing transactions and the
> auto-categorization engine seeds against. Lives at
> [`src/features/tags/`](../../src/features/tags/).

## Purpose

- Render the standalone `/categories` page (the entry point for the
  header Settings gear, see [`src/app/App.tsx`](../../src/app/App.tsx))
  where users add, rename, retype, alias, or delete custom tags.
- Own the `/api/tags` query surface that the categorization rules tab
  and the beneficiary form's category dropdown also consume.
- Surface system-tag protections — the seeded `TOTAL`,
  `MISCELLANEOUS`, and `CONSUMPTION_TAX` rows are read-only; system
  tags allow alias + tag-type edits but not name / parent changes.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/categories` | `pages/TagsPage.tsx` | Add / update / delete tags. Lazy-loaded via `tags.routes.tsx`. |

Routes are exported from
[`features/tags/tags.routes.tsx`](../../src/features/tags/tags.routes.tsx)
and composed into the root router by `src/app/routes.tsx`
(`<TagsPage>` is wrapped by `protectedRoutes()`). The Settings gear
icon in the app header opens the Settings shell, where Categories sits
alongside Categorization Rules and Taxation Rules under `/settings/*`.

## Components

- `pages/TagsPage.tsx` — full standalone page with header, add /
  cancel CTA, expandable tag tree, and the create / update dialog.
  Tailwind-styled with dark-mode parity.

## Responsive

Per [`docs/conventions.md`](../conventions.md):

- The page header + the "All tags" section header use
  `flex-wrap items-start gap-3` so the title block, back link, and
  Add Tag button reflow gracefully at phone widths.
- Each tag row uses `flex-wrap items-start ... sm:flex-nowrap
  sm:items-center` with `min-w-0` on the content area: below `sm`
  the Update / Delete buttons stack underneath the content, and
  long alias chip rows wrap inside the card instead of pushing
  the row past it.
- Section-card padding is `p-4 sm:p-6` so the card has tighter
  horizontal padding on phones.

## State

No Zustand state. Server-state lives in React Query under
`tagKeys.list()`; mutations call
`queryClient.invalidateQueries({ queryKey: tagKeys.all })` so any
component subscribed to the tag tree refreshes after a tag change.

## API

[`api/`](../../src/features/tags/api/)

| File | Exports |
|---|---|
| `keys.ts` | `tagKeys` — `all`, `list()` |
| `schemas.ts` | `tagFormSchema` (Zod), `TagFormInput`, `TagPayload`, `tagFormToPayload(form)` |
| `queries.ts` | `fetchTags`, `fetchTagConstants`, `useTagsQuery`, `TagNode`, `TagConstants` |
| `mutations.ts` | `createTagRequest`, `updateTagRequest`, `deleteTagRequest` |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/tags` | `useTagsQuery` (TagsPage), `BeneficiaryFormFields` category dropdown, `CategorizationRulesTab` |
| `POST /api/tags` | TagsPage create form |
| `PATCH /api/tags/:id` | TagsPage update form |
| `DELETE /api/tags/:id` | TagsPage delete action |
| `GET /api/metadata/constants` | `fetchTagConstants` — surfaces `SYSTEM_USER_ID`, `TOTAL_TAG_ID`, etc. for read-only row decisions |

## Cross-feature seams

- **`features/beneficiaries/components/BeneficiaryFormFields.tsx`**
  imports `fetchTags` + `TagNode` from
  `features/tags/api/queries.ts` to populate the merchant-category
  dropdown. This is the canonical home of `/api/tags` so the
  beneficiary form is the consumer, not the owner.
- **`/api/metadata/constants`** is also consumed by other features
  (categorization, taxation). It physically lives under metadata on
  the backend but TagsPage exposes a dedicated `fetchTagConstants`
  helper so a tag-only page doesn't depend on the metadata feature.

## Tests

| File | Covers |
|---|---|
| `pages/TagsPage.test.tsx` | Tag list renders + alias chips, system-tag indicator surfaces, POST body shape on Create Tag |

MSW handlers for `/api/tags` + `/api/metadata/constants` live in the
test file's `beforeEach` since the global handlers (in
`src/test/handlers/`) don't yet expose a permissive tags default.

## Modal-first CRUD

Add and edit open `components/TagFormDialog.tsx`, a single
`<Modal>` wrapping the tag form. `?add=true` and `?edit=<tag_id>`
URL state make both surfaces shareable. Delete opens
`<ConfirmDialog intent="danger" />` instead of `window.confirm()`. The
tree list itself stays inline on the page.
