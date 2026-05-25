# Transactions feature

> Mirrors `backend/app/modules/transactions`. Owns the manual
> transactions list, create / edit screens, and the statement-upload
> review pipeline. Lives at
> [`src/features/transactions/`](../../src/features/transactions/).

## Purpose

- Render the `/transactions` page (list + merchant aggregation views)
  with paging, filtering, sorting, and bulk navigation to a
  beneficiary's history.
- Drive the manual Add / Edit transaction flows, including the
  optional "create a categorization rule from this tag + beneficiary
  pair" prompt.
- Run the statement-upload pipeline: parse → map beneficiaries →
  categorize → per-row review → finalize.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/transactions` | `pages/TransactionsPage.tsx` | List + merchant views, filters, paging. Lazy-loaded. |
| `/add-transaction` | `pages/AddTransactionPage.tsx` | Manual create. Lazy-loaded. |
| `/transactions/:id/edit` | `pages/EditTransactionPage.tsx` | Edit; statement-sourced rows restrict editable fields to `notes` + `tag_ids`. Lazy-loaded. |
| `/upload-statement` | `statement_upload/pages/UploadStatementPage.tsx` | Three-step async upload pipeline + per-row review. Lazy-loaded. |

Routes are exported from
[`features/transactions/transactions.routes.tsx`](../../src/features/transactions/transactions.routes.tsx)
and composed into the root router by `src/app/routes.tsx`
(`protectedRoutes()` wraps the whole array).

## Components

- `components/BeneficiarySearch.tsx` — type-ahead picker shared by Add
  + Edit. Emits `(name, id)` so the parent can null the id when the
  user types a name that doesn't match any existing beneficiary
  (backend creates a fresh row).
- `components/TagSelector.tsx` — search input + chip rail shared by
  Add + Edit. Dumb component; the miscellaneous-tag rules (drop misc
  when a real tag is added, re-add misc when the last tag is removed)
  live in the parent's `onAdd` / `onRemove` so both forms apply the
  same rule from a single place.
- `statement_upload/components/ProblematicTxnRow.tsx` — per-row
  categorize panel used in the upload review step. Keeps the legacy
  keyboard nav (↑ / ↓ / Enter / Esc through the tag dropdown) since
  statement uploads can include many problematic rows.

## State

No Zustand state owned by this feature. Server state lives in React
Query under `transactionKeys.{list, detail}`; mutations
(create / update / delete + finalize) invalidate `transactionKeys.all`
and `tagKeys.all` (the list page renders tag chips, so a tag rename
elsewhere bubbles up here).

The list filters (page / sort / view-mode / tag / month /
beneficiary-id filter) are page-local `useState` rather than URL
search params — keeps the legacy behaviour where back-navigating from
the Add page reuses the prior filter state. URL-driven filters are a
post-Batch-9 polish, not in scope here.

## API

[`api/`](../../src/features/transactions/api/)

| File | Exports |
|---|---|
| `keys.ts` | `transactionKeys` (`all`, `lists()`, `list(params)`, `detail(id)`), `statementUploadKeys`, `TransactionListParams` |
| `schemas.ts` | `transactionFormSchema` (Zod), `TransactionFormInput`, `TransactionCreatePayload`, `TransactionUpdatePayload`, `TransactionDTO`, `TransactionListResponse`, `MerchantGroup`, `SingleTransactionResponse`, `ProblematicTxn`, `UploadResult` |
| `queries.ts` | `fetchTransactions`, `fetchTransaction`, `useTransactionsQuery` |
| `mutations.ts` | `createTransactionRequest`, `updateTransactionRequest`, `deleteTransactionRequest`, `uploadStatementRequest`, `mapBeneficiariesRequest`, `categorizeUploadRequest`, `saveManualTagsRequest`, `finalizeUploadRequest`, `FinalizeDecision` |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/transactions` | TransactionsPage (with filter / sort / paging params) |
| `GET /api/transactions/:id` | EditTransactionPage load |
| `POST /api/transactions[?rule_id=…]` | AddTransactionPage |
| `PATCH /api/transactions/:id[?rule_id=…]` | EditTransactionPage |
| `DELETE /api/transactions/:id` | TransactionsPage row action menu |
| `POST /api/transactions/upload-statement` | UploadStatementPage step 1 |
| `POST /api/transactions/upload-statement/:id/map-beneficiaries` | UploadStatementPage step 2 |
| `POST /api/transactions/upload-statement/:id/categorize` | UploadStatementPage step 3 |
| `POST /api/transactions/:id/manual-tags` | UploadStatementPage per-row save |
| `POST /api/transactions/upload-statement/:id/finalize` | UploadStatementPage commit / set_misc / rollback |
| `GET /api/categorization-rules` | EditTransactionPage tag-changed flow |
| `POST /api/categorization-rules` | AddTransactionPage + EditTransactionPage (helper lives in `features/beneficiaries/api/mutations.ts`; see Cross-feature seams) |
| `PUT /api/categorization-rules/:uid` | EditTransactionPage update-existing-rule path |
| `GET /api/tags` | All pages — flat tag list for chips + search dropdowns |
| `GET /api/metadata/constants` | Add / Edit — Misc + Total tag IDs for the chip rules |

## Responsive

Per CONTRIBUTING.md §6:

- TransactionsPage table scrolls *inside its card*
  (`overflow-x-auto` on the wrapper + `min-w-[36rem]` on the
  `<table>`); `body` never overflows on phone widths even with five
  data columns.
- Header action row uses `flex-wrap gap-2`; "Add Transaction" /
  "Beneficiaries" / "Dashboard" buttons stack below the title on
  narrow viewports.
- Filter row uses `flex-wrap` so the view-mode toggle, three filter
  selects, month picker, and clear-filter button reflow vertically.
- Add / Edit forms use a single-column layout that widens to a 2-up
  grid (`grid-cols-1 sm:grid-cols-2`) for amount + type only —
  everything else stays full-width so labels never collide with
  inputs.
- Submit + Cancel buttons stack on phones (`flex-col sm:flex-row`).
- UploadStatementPage's finalize actions row uses `flex-wrap gap-3`;
  the three CTAs stack rather than overflow horizontally.

## Cross-feature seams

- **Reads `useTagsQuery` + `TagNode`** from `features/tags/api/queries`
  to fetch the flat tag list (and `fetchTags` imperatively from
  AddTransactionPage / EditTransactionPage so the prefs-hydration
  startup path doesn't pay for a hook).
- **Reads `fetchBeneficiaries`** from
  `features/beneficiaries/api/queries` for the BeneficiarySearch
  dropdown; same direction as Batch 4 set (beneficiaries → tags,
  transactions → both).
- **Reads `useCurrenciesQuery`** from `features/metadata/api/queries`
  so TransactionsPage can resolve `code → symbol` for the
  `formatMoney` calls. Currency code itself comes from
  `usePreferencesStore` (the source of truth for the header).
- **Imports `createCategorizationRule`** from
  `features/beneficiaries/api/mutations.ts`. That helper sits in the
  beneficiaries feature per Batch 4's choice — creating a rule from
  a transaction's beneficiary + tag pair is the same write that
  BeneficiaryFormFields uses, and we keep one canonical home for the
  rule mutation surface (Batch 6's categorization feature will read
  / manage rules but won't relocate the writes).

## Money + date formatting

Every amount goes through `shared/utils/currency.ts → formatMoney`;
every date through `shared/utils/dateUtils.ts → formatDate`. The
`new Date().toISOString().split('T')[0]` pattern from the legacy
AddTransactionPage was replaced with `todayInUserTz(timezone)` so
date defaults respect the user's tz (per the §5 contract).

## Tests

| File | Covers |
|---|---|
| `pages/TransactionsPage.test.tsx` | List render, dropdown gating by source, pagination, merchant view + Details filter, delete-flow via MSW DELETE handler |
| `pages/AddTransactionPage.test.tsx` | Field rendering, end-to-end POST body shape + navigate, error display on 500 |
| `pages/EditTransactionPage.test.tsx` | Not-found render, manual edit + PATCH body, statement-source field restrictions, misc → real-tag replacement |
| `statement_upload/pages/UploadStatementPage.test.tsx` | Pipeline call order (upload → map → categorize), error display on upload failure |

All MSW handlers register per-test via `server.use(...)` — the
transactions feature doesn't yet have permissive defaults in
`src/test/handlers/`. Future batches that hit the same endpoints can
promote a shared `transactions.ts` handler if convergence emerges.
