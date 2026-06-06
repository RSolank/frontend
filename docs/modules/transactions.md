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
- Run the async statement-upload pipeline (BE Phase 2.2,
  `ac4ad00`): POST a file → 202 with `{job_id}`. The page
  **redirects to `/dashboard` immediately on submit** (Batch 20
  UAT, `bf1b9be`); the in-flight job lives on in the bottom-right
  Dock from any page. Poll `GET /statement-uploads/{job_id}` until
  the job reaches `COMPLETED` or `FAILED`. The FE owns parser-class
  selection (filename match + a picker modal); the chosen class
  is sent as `parser_override` so the BE skips its own detection,
  with internal failover to detection if parsing with the chosen
  class fails. Bank-account auto-attribution + categorization
  run in the background task; **the recurring engine also runs
  post-completion on the same job** (BE-side service reuse, not a
  new stage) — the FE Dock fires a delayed cache invalidation to
  pick that up.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/transactions` | `pages/TransactionsPage.tsx` | List + merchant + calendar views, filters, paging. Hosts Add / Edit / Delete as modals (see "Modal-first CRUD on the list" below). Lazy-loaded. |
| `/add-transaction` | `AddRedirect` (in `transactions.routes.tsx`) | Legacy alias — redirects to `/transactions?add=true`. The page module mounts inline inside the modal. |
| `/transactions/:id/edit` | `EditRedirect` (in `transactions.routes.tsx`) | Legacy alias — redirects to `/transactions?edit=<id>`. Edit modal mounts the same `EditTransactionPage` component with `embedded`. Statement-sourced rows still restrict editable fields to `notes` + `tag_ids`. |
| `/upload-statement` | `statement_upload/pages/UploadStatementPage.tsx` | Async upload + job-poll surface (file picker → 202 → progress states → COMPLETE/FAILED card). Lazy-loaded. |

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
- `components/CalendarView.tsx`, `components/FilterSidebar.tsx`,
  `components/MerchantSearchBar.tsx`, `components/MonthDropdown.tsx`,
  `components/TransactionRow.tsx`, `components/MerchantRow.tsx`,
  `components/DaySidePanel.tsx` — pieces of the URL-state-driven view
  system on `TransactionsPage` (list / merchants / calendar). Detailed
  shapes + URL contract under § View system below.
- `statement_upload/components/StatementUploadDock.tsx` — fixed
  bottom-right widget mounted from the app shell when the
  `useStatementUploadJobStore` reports an active job id. Polls
  `GET /statement-uploads/{job_id}` (2s adaptive) and surfaces the
  in-flight status. Hosts a
  [`<StatementProgressRing>`](../../src/features/transactions/statement_upload/components/StatementProgressRing.tsx)
  — circular progress driven by the 8-state `JobStage` enum
  (`queued → parsing → attributing → staging → mapping_beneficiaries
  → categorizing → computing_tax → done`) so the user sees the parse
  advance even while navigating other pages. Hides on
  `/upload-statement` (the page renders the same content inline) and
  auto-clears 6s after `COMPLETED`; `FAILED` states persist until the
  user dismisses them. **On COMPLETED**, the dock fires a downstream
  cache-invalidation sweep: transactions / taxation / dashboard
  invalidate immediately; recurring + upcoming-bills invalidate again
  on a 5-second delay to catch the BE's piggy-backed recurring-engine
  run (BE reuses the service on the same `job_id` post-parse — see
  [`categorization.md`](categorization.md)). The Dock chunk is
  force-prefetched on `UploadStatementPage` mount so the bottom-right
  surface is instantly visible after submit.
- `statement_upload/components/ParserPickerModal.tsx` — radio-
  list modal listing the parser catalog. Opens from the
  "Change parser" link on the matched-parser card and from the
  "Pick parser" button in the 422 inline error. Confirm sends
  the chosen registry **class key** as `parser_override` on the
  next upload. The match-card is rendered inline inside
  `UploadStatementPage`'s `<UploadCard>` (small, feature-private,
  not exported).
- `statement_upload/components/ParserIcon.tsx` — UPI-brand icon
  for parser rows. Maps the parser registry key to a simpleicons.org
  CDN URL (PhonePe / Paytm / Google Pay — CC0 licensed, no bundled
  assets). Generic CSV / unknown parsers fall through to a neutral
  file-icon glyph.
- Cross-feature embeds (Batch 13): the Add and Edit transaction
  forms mount
  [`bankAccounts/components/BankAccountField`](../../src/features/bankAccounts/components/BankAccountField.tsx) —
  a label + picker + helper field that hides entirely when the
  user has no bank accounts. Selection is sent as
  `bank_account_id` on the POST/PATCH body; FastAPI ignores
  unknown fields until BE adds the column to the
  transaction schemas (open BE handoff). The Edit picker can't
  pre-load the saved value until that lands; helper text spells
  out the gap.

## State

One Zustand store — `shared/state/statementUploadJob.store.ts`
(lives in `shared/` so the app shell can mount the dock without
crossing the boundaries rule). Tracks `activeJobId` + a
`dismissed` flag; `persist`-backed under `pba.statement-upload-job`
so an in-flight job survives a tab refresh.

Server state lives in React Query under `transactionKeys.{list,
detail}` and `statementUploadKeys.job(jobId)`. Mutations
(create / update / delete) invalidate `transactionKeys.all` and
`tagKeys.all` (the list page renders tag chips, so a tag rename
elsewhere bubbles up here). The job poll has `staleTime:
Infinity` once it lands a terminal payload — `COMPLETE` /
`FAILED` rows never change, so a navigation away and back doesn't
re-fire the GET.

The list filters (page / sort / view-mode / tag / month /
beneficiary-id filter) are page-local `useState` rather than URL
search params — keeps the legacy behaviour where back-navigating from
the Add page reuses the prior filter state. URL-driven filters are a
a future polish, not in scope here.

## API

[`api/`](../../src/features/transactions/api/)

| File | Exports |
|---|---|
| `keys.ts` | `transactionKeys` (`all`, `lists()`, `list(params)`, `detail(id)`), `TransactionListParams` |
| `schemas.ts` | `transactionFormSchema` (Zod), `TransactionFormInput`, `TransactionCreatePayload`, `TransactionUpdatePayload`, `TransactionDTO`, `TransactionListResponse`, `MerchantGroup`, `SingleTransactionResponse` |
| `queries.ts` | `fetchTransactions`, `fetchTransaction`, `useTransactionsQuery` |
| `mutations.ts` | `createTransactionRequest`, `updateTransactionRequest`, `deleteTransactionRequest` |

The async statement-upload API lives at
[`statement_upload/api/`](../../src/features/transactions/statement_upload/api/):

| File | Exports |
|---|---|
| `keys.ts` | `statementUploadKeys` (`all`, `job(id)`, `parsers()`) |
| `schemas.ts` | `JobStatus`, `TERMINAL_JOB_STATUSES`, `isTerminalStatus`, `UploadAcceptedResponse`, `JobStatusResponse`, `ParserOption`, `HARDCODED_PARSER_CATALOG`, `NoParserDetectedDetail`, `extractNoParserDetail` |
| `queries.ts` | `fetchJobStatus`, `useJobStatusQuery(jobId)` (2s adaptive poll; `staleTime: Infinity` once terminal), `fetchParserCatalog`, `useParserCatalogQuery()` (graceful 404 fallback to `HARDCODED_PARSER_CATALOG`) |
| `mutations.ts` | `uploadStatementJobRequest(file, parserOverride?)` (POST 202 + `{job_id}`; appends `parser_override` to FormData when set), `manualTagTransactionRequest(txnId, tagIds)` (re-tag statement-imported rows) |
| `parserMatch.ts` | `matchParserByFilename(filename, catalog)` — pure predictor matching the filename stem against each parser's `key` / `source_type` / first label word; tie-break by registration order (mirrors BE `detect_parser`). |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/v1/transactions` | TransactionsPage (with filter / sort / paging params) |
| `GET /api/v1/transactions/:id` | EditTransactionPage load |
| `POST /api/v1/transactions[?rule_id=…]` | AddTransactionPage |
| `PATCH /api/v1/transactions/:id[?rule_id=…]` | EditTransactionPage |
| `DELETE /api/v1/transactions/:id` | TransactionsPage row action menu |
| `POST /api/v1/statement-uploads` | UploadStatementPage submit (sends `parser_override` form field) |
| `GET /api/v1/statement-uploads/{job_id}` | UploadStatementPage + StatementUploadDock poll |
| `GET /api/v1/statement-uploads/parsers` | UploadStatementPage parser-picker (graceful 404 fallback to `HARDCODED_PARSER_CATALOG`; BE handoff — pending route signature) |
| `POST /api/v1/transactions/:id/manual-tags` | Re-tag a statement-imported transaction (still wired, called by future transactions DetailModal flow) |
| `GET /api/v1/categorization-rules` | EditTransactionPage tag-changed flow |
| `POST /api/v1/categorization-rules` | AddTransactionPage + EditTransactionPage (helper lives in `features/beneficiaries/api/mutations.ts`; see Cross-feature seams) |
| `PUT /api/v1/categorization-rules/:uid` | EditTransactionPage update-existing-rule path |
| `GET /api/v1/tags` | All pages — flat tag list for chips + search dropdowns |
| `GET /api/v1/metadata/constants` | Add / Edit — Misc + Total tag IDs for the chip rules |

## Responsive

Per [`docs/conventions.md`](../conventions.md):

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
- UploadStatementPage's panel footer uses `flex-wrap gap-3`; the
  "View transactions" + "Upload another" / "Try again" / "Start
  over" CTAs stack rather than overflow horizontally.
- StatementUploadDock is `fixed bottom-4 right-4 w-72` —
  comfortably above the iOS Safari toolbar; clipped narrow
  widths still leave room for the touch-target controls.

## Cross-feature seams

- **Reads `useTagsQuery` + `TagNode`** from `features/tags/api/queries`
  to fetch the flat tag list (and `fetchTags` imperatively from
  AddTransactionPage / EditTransactionPage so the prefs-hydration
  startup path doesn't pay for a hook).
- **Reads `fetchBeneficiaries`** from
  `features/beneficiaries/api/queries` for the BeneficiarySearch
  dropdown (beneficiaries → tags, transactions → both).
- **Reads `useCurrenciesQuery`** from `shared/api/referenceData`
  so TransactionsPage can resolve `code → symbol` for the
  `formatMoney` calls. Currency code itself comes from
  `usePreferencesStore` (the source of truth for the header).
- **Imports `createCategorizationRule`** from
  `features/beneficiaries/api/mutations.ts`. That helper sits in the
  beneficiaries feature — creating a rule from a transaction's
  beneficiary + tag pair is the same write that BeneficiaryFormFields
  uses, so the rule mutation surface keeps one canonical home; the
  categorization feature reads / manages rules but doesn't relocate
  the writes.
- **Imports `<BankAccountField>`** from
  `features/bankAccounts/components/BankAccountField.tsx` (Batch 13)
  on Add / Edit transaction forms. The field self-hides when the
  user has no bank accounts; selection is sent as
  `bank_account_id` in the POST / PATCH body. eslint
  `boundaries/dependencies` carries an explicit
  `transactions → bankAccounts` allow entry alongside the
  pre-existing `transactions → beneficiaries / tags` entries.

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
| `statement_upload/pages/UploadStatementPage.test.tsx` | Async-job lifecycle (file picker → 202 → poll → COMPLETE/FAILED card), 409 duplicate inline error, 422 + `available_parsers` opens picker modal, `suggest_register_account` notice + CTA href, filename-match → match-card render, no-match → inline dropdown forces explicit pick, `Change parser` overrides match, upload POST sends `parser_override` in FormData. |
| `statement_upload/components/StatementUploadDock.test.tsx` | No-render without active job; hides on `/upload-statement`; renders PARSING with file name + status; FAILED + dismiss clears the store. |
| `statement_upload/api/parserMatch.test.ts` | Filename-match catalog matching (PhonePe / future parsers / case-insensitivity / first-label-word fallback); generic-filename returns null; first-registered tie-break; extension-strip false-positive guard. `ParserPickerModal` itself has no dedicated test file — exercised indirectly via UploadStatementPage tests. |

**MSW handlers.** The root `transactions` resource still registers
per-test via `server.use(...)` — no permissive `transactions.ts`
default in `src/test/handlers/`. The `statement_upload` submodule
does have a shared default at `src/test/handlers/statement-upload.ts`
(added Batch 12): POST 202 + GET COMPLETE happy-path stubs + GET
/parsers 404 (graceful-catalog-fallback exercise). Future batches
that hit the root txn endpoints can promote a shared `transactions.ts`
handler if convergence emerges.

## Modal-first CRUD on the list

`TransactionsPage.tsx` hosts add / edit / delete as modals over the list:

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
surface via these redirect aliases.

The `AddTransactionPage` / `EditTransactionPage` modules remain
mount-as-page-able because of the `embedded` flag — when `true` they
skip their outer card + h1 (the modal supplies them); when `false`
(default) they render with their original page chrome.

## View system — calendar, filter sidebar, infinite scroll

Overhaul of the page chrome alongside the calendar view. Single source
of truth for every filter is the URL via `useTransactionFilters`
(`state/transactionFilters.ts`) — no more local-component or Zustand
persistence; URL state survives reloads, syncs across tabs, and makes
filter deep-links shareable.

### Three-pill view toggle

`[ List | Merchant | Calendar ]` driven by `?view=list|merchant|calendar`.
All three are sibling views — List and Calendar are visualizations,
Merchant is a server-side `group_by` aggregation. The earlier "List
View / Merchant View" inner toggle is gone; Merchant
is a top-level peer.

### Merchant view scope pill

BE `9c00ecd` (Batch 20 UAT, `b3abfee`) changed the grouped read default
when no `month`/`period`/`date` filter is set — `GET /transactions?group_by=merchant|tag`
now aggregates **all-time** instead of silently scoping to the current
month (the motivating bug: backdated imports left the merchant view
empty despite the trackers being populated). The grouped response
envelope carries the active window:

- `period_type: 'weekly' | 'monthly' | 'all'`
- `period_start: string | null` (null for the all-time window)

The merchant view header renders a `<span data-testid="merchant-scope-pill">`
next to the merchant count showing the BE-supplied window — "All time",
`formatYearMonth(period_start)` ("Feb 2026"), or a weekly range
("Feb 9 → Feb 15"). The empty-state copy is scope-aware:
"No merchants across your history yet." (all-time) vs "No merchants
for Feb 2026." (monthly). Both `period_type` + `period_start` are
optional fields on `TransactionListResponse` in `api/schemas.ts`; the
auto-generated `GroupedTransactionsResponse` in `shared/types/api.ts`
carries the union typing.

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
  picker against `/api/v1/beneficiaries`. Selecting a beneficiary sets
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
  (per the DetailModal convention — see
  [`docs/conventions.md`](../conventions.md)).
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
`date desc`; Merchant defaults to `net_expense desc`. The URL omits
the keys when at-default so links stay clean.

The sort enum (`date | amount | total_count | net_expense | name`)
mirrors the BE Phase 1.7 (T-aggregates-engine) contract.
`total_count` (was `frequency`) and `net_expense` (was
`total_amount`) replaced the legacy field names; merchant rows now
bind against the new field names.

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
[`docs/conventions.md`](../conventions.md) a11y contract.

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
([`docs/conventions.md` "Week convention"](../conventions.md)).
`weekRangeInTz` from
[`features/taxation/api/billPeriod.ts`](../../src/features/taxation/api/billPeriod.ts)
is the canonical helper; the calendar's month grid pads to full
ISO weeks via that helper. See the convention section in
CONTRIBUTING.md for the backend coordination status.
