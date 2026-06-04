# Tags feature

> Mirrors `backend/app/modules/tags`. Owns the hierarchical category
> tree the user picks from when categorizing transactions and the
> auto-categorization engine seeds against. Lives at
> [`src/features/tags/`](../../src/features/tags/).

## Purpose

- Render `/settings/categories` inside the
  [Settings shell](settings.md) where users add, rename, retype,
  alias, or delete custom tags.
- Own the `/api/v1/tags` query surface that the categorization rules tab
  and the beneficiary form's category dropdown also consume.
- Surface system-tag protections — the seeded `TOTAL`,
  `MISCELLANEOUS`, and `CONSUMPTION_TAX` rows are read-only; system
  tags allow alias + tag-type edits but not name / parent changes.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/settings/categories` | `pages/TagsPage.tsx` | Mounted by the settings shell. Add / update / delete tags. Lazy-loaded. |

The TagsPage is registered by
[`features/settings/settings.routes.tsx`](../../src/features/settings/settings.routes.tsx)
as a child of `/settings`. The legacy top-level `/categories` URL
was retired in the Batch 9 settings shell — see
[`docs/modules/settings.md`](settings.md).

## Components

- `pages/TagsPage.tsx` — full standalone page with header, add /
  cancel CTA, expandable tag tree, and the create / update dialog.
  Tailwind-styled with dark-mode parity.
- `components/TagFormDialog.tsx` — `<Modal size="md">` add/edit
  dialog opened from `TagsPage` (`?add=true` / `?edit=<uid>`).
  Owns the name + parent picker + tag-type radio + alias chips,
  the inherited-context preview when a parent is set, and the
  cycle-prevention guard on parent selection. Saves via
  `POST /api/v1/tags` (create) or `PATCH /api/v1/tags/:uid` (edit);
  Delete + "Delete tree" actions live in the dialog footer with
  ConfirmDialog gates.

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
| `GET /api/v1/tags` | `useTagsQuery` (TagsPage), `BeneficiaryFormFields` category dropdown, `CategorizationRulesPage` |
| `POST /api/v1/tags` | TagsPage create form |
| `PATCH /api/v1/tags/:id` | TagsPage update form |
| `DELETE /api/v1/tags/:id` | TagsPage delete action |
| `GET /api/v1/metadata/constants` | `fetchTagConstants` — surfaces `SYSTEM_USER_ID`, `TOTAL_TAG_ID`, etc. for read-only row decisions |

## Cross-feature seams

- **`features/beneficiaries/components/BeneficiaryFormFields.tsx`**
  imports `fetchTags` + `TagNode` from
  `features/tags/api/queries.ts` to populate the merchant-category
  dropdown. This is the canonical home of `/api/v1/tags` so the
  beneficiary form is the consumer, not the owner.
- **`/api/v1/metadata/constants`** is also consumed by other features
  (categorization, taxation). It physically lives under metadata on
  the backend but TagsPage exposes a dedicated `fetchTagConstants`
  helper so a tag-only page doesn't depend on the metadata feature.

## Tests

| File | Covers |
|---|---|
| `pages/TagsPage.test.tsx` | Tag list renders + alias chips, system-tag indicator surfaces, POST body shape on Create Tag |

MSW handlers for `/api/v1/tags` + `/api/v1/metadata/constants` live in the
test file's `beforeEach` since the global handlers (in
`src/test/handlers/`) don't yet expose a permissive tags default.

## Modal-first CRUD

Add and edit open `components/TagFormDialog.tsx`, a single
`<Modal>` wrapping the tag form. `?add=true` and `?edit=<tag_id>`
URL state make both surfaces shareable. Delete opens
`<ConfirmDialog intent="danger" />` instead of `window.confirm()`. The
tree list itself stays inline on the page.
