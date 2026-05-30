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

## Batch 6.5 — modal-first CRUD on the list

`TransactionsPage.tsx` now hosts add / edit / delete as modals over
the list:

- **Add** — `+ Add Transaction` button calls
  `useModal({ urlKey: 'add' }).open()`. The modal mounts
  `<AddTransactionPage embedded onClose={...} />` (same component
  that ships on the legacy route, now with optional `embedded` +
  `onClose` props).
- **Edit** — row Edit button calls `useUrlValueModal('edit').openWith(txn_id)`.
  Modal mounts `<EditTransactionPage embedded idOverride={...} onClose={...} />`.
- **Delete** — `<ConfirmDialog intent="danger" />` replaces
  `window.confirm()`.

The legacy routes `/add-transaction` and `/transactions/:id/edit`
have become **redirects** (`transactions.routes.tsx`) that bounce to
`/transactions?add=true` and `/transactions?edit=<id>` respectively.
Deep links from older bookmarks still land on the canonical modal
surface; the route URL renames are deferred to Batch 9 per the plan.

The `AddTransactionPage` / `EditTransactionPage` modules remain
mount-as-page-able because of the `embedded` flag — when `true` they
skip their outer card + h1 (the modal supplies them); when `false`
(default) they render with their original page chrome.

## Batch 9.6 — View system, calendar, filter sidebar, infinite scroll

Overhaul of the page chrome alongside the calendar view. Single source
of truth for every filter is the URL via `useTransactionFilters`
(`state/transactionFilters.ts`) — no more local-component or Zustand
persistence; URL state survives reloads, syncs across tabs, and makes
filter deep-links shareable.

### Three-pill view toggle

`[ List | Merchant | Calendar ]` driven by `?view=list|merchant|calendar`.
All three are sibling views — List and Calendar are visualizations,
Merchant is a server-side `group_by` aggregation. The earlier "List
View / Merchant View" inner toggle (post-Batch-6.5) is gone; Merchant
is a top-level peer.

### Filter sidebar

Right-edge slide-in panel (`components/FilterSidebar.tsx`) holds the
filters and sort UI that don't warrant always-visible chrome: Type
(All/Debit/Credit), Tag, Sort by + Direction. Activated via a
`Filters` button on Row 2 — an `(n)` badge shows the count of
non-default sidebar filters. Built on Radix Dialog (same primitive
family as `DaySidePanel`); slide-in animation, focus trap, escape
close, scroll lock. Footer carries `[Clear all] [Done]`.

### Always-visible Row 2 controls

- **Month dropdown** (`components/MonthDropdown.tsx`) — rolling 24-month
  list + "All months" head option, computed at component-mount time
  against today in the browser tz. No backend dependency. Hidden in
  Calendar view (calendar has its own ◀ ▶ month nav).
- **Merchant search** (`components/MerchantSearchBar.tsx`) — typeahead
  picker against `/api/beneficiaries`. Selecting a beneficiary sets
  `?beneficiary=<id>`; server-side filter (`beneficiary_id`)
  scales across pages. The bar shows in all three views — yes,
  including Calendar, because a heat-map of one merchant's spending
  across the month is genuinely useful.

### Row-list rendering

The `<table>` is replaced by `components/TransactionRow.tsx` (List
view) + `components/MerchantRow.tsx` (Merchant view). Single
component, fully responsive:

- **Desktop ≥ md:** compact `<ul>` of flex-row `<li>`s. No column
  headers (sort moved to sidebar). Date in `Wed, May 28` shape via
  `formatDate(..., { weekday: 'short', month: 'short', day: 'numeric' }, respectUserFormat=false)`.
  Tags as chips inline before the amount. Amount right-aligned, tabular
  numerals. `⋯` button on the far right is the view + edit affordance
  (per the "modal-as-view+edit" convention locked in this batch — see
  CONTRIBUTING.md §6).
- **Mobile < md:** same `<ul>` reflows to `flex-col` per row, name
  above amount, tags wrap; functionally a card without the explicit
  border. Same DOM, different shape — Tailwind responsive utilities
  switch.

### Pagination

`useInfiniteTransactionsQuery` (`api/queries.ts`) replaces the prior
manual pagination. Pages accumulate via TanStack Query's
`useInfiniteQuery`. Two trigger surfaces:

- **Mobile < md:** "Show more" button at the bottom of the list.
- **Desktop ≥ md:** IntersectionObserver-driven auto-load. Sentinel
  `<div ref={sentinelRef} className="hidden md:block">` is invisible
  on mobile (no intersection events fire) and triggers fetch when
  scrolled into view on desktop. No JS device sniffing —
  display:none + IntersectionObserver semantics give us the divide
  for free.

The shared hook is at `shared/hooks/useIntersectionObserver.ts`
(generic — accepts a callback, returns a ref, gates by `enabled`).

### URL state mapping

| URL key | Meaning |
|---|---|
| `?view=list\|merchant\|calendar` | Primary view |
| `?type=debit\|credit` | Type filter |
| `?tag=<id>` | Tag filter |
| `?month=YYYY-MM` | Month dropdown (List + Merchant) |
| `?beneficiary=<id>` | Merchant search |
| `?sort=<field>&order=asc\|desc` | Sort spec |
| `?day=YYYY-MM-DD` | Calendar day flyout |
| `?add=true`, `?edit=<id>` | Modal state (existing) |

Sort defaults vary by view: List + Calendar default to
`date desc`; Merchant defaults to `total_amount desc`. The URL omits
the keys when at-default so links stay clean.

### Calendar (carry-over from initial 9.6 spec)

Responsive shape:

- **Desktop ≥ lg:** full month grid (7 × 6 cells). Prev / next month
  arrows + a "Today" jump button. Heat-map shading by per-day debit
  total (quartile buckets against the visible month's max). Today
  carries an extra indigo ring on top of the heat tint.
- **Mobile < lg:** swipeable single ISO week (7 cells). Prev / next
  week arrows + "Today" jump.

Both surfaces render simultaneously and Tailwind's `lg:` breakpoint
controls visibility. Keyboard nav (arrow keys move focus; Enter /
Space opens the day) works on whichever grid is mounted, per
[CONTRIBUTING.md §6](../../CONTRIBUTING.md) a11y contract.

**Data flow.** Calendar mode issues its own `useTransactionsQuery`
with `month=<YYYY-MM>` and no debit/credit filter — page filters
don't bleed into the calendar (mode is meant as a glance view). The
query cache for the displayed month is shared with the day flyout
when it sits inside the same month.

**Day flyout** — `components/DaySidePanel.tsx`. Right-edge slide-in
panel on ≥ sm; bottom-sheet on < sm. Built directly on Radix UI's
Dialog primitives rather than `shared/components/Modal.tsx` because
the responsive shape (edge slide-in vs centered card) is materially
different. URL-state synced via `useUrlValueModal('day')` →
`/transactions?day=YYYY-MM-DD` is shareable and survives reload.
The panel lists every transaction on the selected day with totals
+ a "+ Add transaction for this day" CTA. When clicked, the iso
date is captured into local state, the panel closes, and the
existing add modal opens with the day pre-filled via a new
`defaultDate` prop on `AddTransactionPage`.

**Editing from the panel** — clicking a row's Edit link closes the
side panel and opens the existing `?edit=<id>` modal. Same flow as
the list view, no new edit surface.

**Helpers added:** `api/calendar.ts` —
`buildMonthGrid(monthKey, todayIso)`, `buildWeekRow(anchorIso,
todayIso)`, `bucketByDay(txns, tz)`, `heatBucket(value, max)`,
`shiftMonthKey`, `shiftIso`, `monthKeyFromIso`, `todayIsoInTz(tz)`.
All pure functions; tests under `api/calendar.test.ts`.

**Week convention** — ISO 8601 (Mon → Sun), per the project
convention locked alongside this batch
([CONTRIBUTING.md §6 "Week convention"](../../CONTRIBUTING.md)).
`weekRangeInTz` from
[`features/taxation/api/billPeriod.ts`](../../src/features/taxation/api/billPeriod.ts)
is the canonical helper; the calendar's month grid pads to full
ISO weeks via that helper. See the convention section in
CONTRIBUTING.md for the backend coordination status.
