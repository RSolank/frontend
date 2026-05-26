# Taxation feature

> Mirrors `backend/app/modules/taxation`. Owns the **Tax Tracker**
> surface (live current-week running tax + finalized bill detail + bill
> generation) and the **Taxation Rules** settings page (per-`txn_type`
> base tax + default penalty rates). Lives at
> [`src/features/taxation/`](../../src/features/taxation/).

## Purpose

- Render `/consumption-tax` as the Tax Tracker page — the canonical
  view of the consumption-tax flow: in-progress week's running tax,
  generation form for past-week bills, a sortable list of finalized
  bills with status pills, and a per-bill detail modal that surfaces a
  penalty breakdown by budget tag.
- Render `/settings/taxation-rules` as a flat, edit-in-place list of
  the four canonical `txn_type` rules (committed / essential /
  discretionary / uncategorized). Each card carries a humanized
  percentage display (5%, 12.5%) and an inline editor that accepts
  `5%` / `0.05` / `5` (assumed %).
- Own the `/api/taxation-rules` and `/api/consumption-tax/*` query /
  cache key namespaces (`taxationKeys` in
  [`api/keys.ts`](../../src/features/taxation/api/keys.ts)).

## Pages

| Path | Component | Notes |
|---|---|---|
| `/consumption-tax` | `pages/TaxTrackerPage.tsx` | Lazy-loaded. URL preserved from the pre-refactor; the nav label is "Tax Tracker" per Batch 6.5's "rename labels, not URLs" rule. |
| `/settings/taxation-rules` | `pages/TaxationRulesPage.tsx` | Lazy-loaded. Lives at the canonical Batch 9 URL so the Settings shell consolidation lands without a redirect. |

Routes are exported from
[`taxation.routes.tsx`](../../src/features/taxation/taxation.routes.tsx)
and composed into the root router by `src/app/routes.tsx`
(both pages are wrapped by `protectedRoutes()`).

Before Batch 7 these surfaces lived at:
- `src/pages/tax/ConsumptionTaxPage.jsx` (raw `apiFetch` + inline
  `useState` + inline-styled bills list with expandable detail rows).
- `src/pages/user/settings/TaxationRulesTab.jsx` (rendered inside the
  `/settings` husk as the only remaining tab).

Both legacy files are deleted in Batch 7; the `/settings` husk is
thinned to a three-link landing index that points at Taxation Rules
+ Categorization Rules + Categories. Batch 9's `SettingsLayout` shell
replaces this index.

## Tax Tracker enhancement (Batch 7)

The current-week tracker card is the new surface in Batch 7. It calls
`GET /api/consumption-tax/tracker/current-week` for:

- `running_tax` / `running_penalty` — sum of tax / penalty accrued for
  in-progress week's transactions.
- `projected_tax` / `projected_penalty` — backend-supplied or
  client-derived linear projection.
- `per_tag[]` — top contributing tags for the in-progress week.

When the backend hasn't shipped the endpoint yet (HTTP 404 / 501), the
card renders a "Backend pending — see Tax Tracker handoff" empty state
with the active week label so the surface still looks structurally
complete. Once the endpoint lands, the card automatically populates —
no frontend follow-up.

Bill detail modal (`components/BillDetailDialog.tsx`):

- Totals strip — total amount, tax total, penalty total.
- Penalty breakdown — aggregates the per-txn penalty lines by tag and
  ranks descending so the user sees which budget breaches drove the
  bill.
- Per-txn table — date / beneficiary / type / tax / penalty / penalty
  tag, with `formatDate` honoring the user's timezone and
  `formatMoney` honoring the user's currency.

## Components

- `pages/TaxTrackerPage.tsx` — page-level surface. Header hosts the
  primary **Generate / refresh bills** button (opens
  `<GenerateBillsDialog />`); body stacks `<CurrentWeekTracker />`
  → bills list. Uses `useUrlValueModal('view')` so
  `/consumption-tax?view=<id>` is shareable + reload-safe.
- `pages/TaxationRulesPage.tsx` — read-only card list. Each
  `<RuleCard />` renders the rule as label / value pairs (no inline
  form fields per the 2026-05-26 design lock — "view surfaces never
  render inputs"); the top-line Edit affordance opens
  `<TaxationRuleFormDialog editingRule={…} />`. The page header
  hosts an **Add rule** button that's visible iff some
  `TAXABLE_TXN_TYPE` lacks a customized rule.
- `components/TaxationRuleFormDialog.tsx` — shared dialog for both
  Add and Edit. Edit mode: txn_type rendered as a read-only label;
  Add mode with one missing type: type prefilled + read-only; Add
  mode with multiple missing types: `<select>` picker of the
  available types. Save calls `PUT /api/taxation-rules/:txn_type`
  (upsert — see backend handoff for why no POST is needed).
- `components/GenerateBillsDialog.tsx` — modal-first generation
  surface. Week-picker or date-range mode; computes Sun→Sat
  boundaries in the user's tz; blocks generation for periods ending
  at-or-after `precedingWeekStart`.
- `components/CurrentWeekTracker.tsx` — running-tax card with status
  stats, a week-progress bar, and a top-5 per-tag breakdown. Falls
  back to a "pending" empty state when the endpoint 404s.
- `components/BillDetailDialog.tsx` — `<Modal size="xl">` wrapper for
  the bill detail surfaces. Items table renders **Date / Beneficiary
  / Type / Amount / Tax / Penalty / Penalty tag**. When the bill is
  `pending` and the caller passes an `onPay` prop, a **Pay bill**
  action appears in the modal footer alongside Close — mirroring
  the row-level Pay button so the user can settle the bill without
  exiting the breakdown view.

## Hooks

| Hook | Purpose |
|---|---|
| `useTaxationRulesQuery` | `GET /api/taxation-rules/` → `{ rules[] }`. |
| `useBillsQuery` | `GET /api/consumption-tax/bills` → `{ bills[] }`. |
| `useBillQuery(billId)` | Lazy `GET /api/consumption-tax/bills/:id` — only fires when `billId != null`. |
| `useTrackerCurrentWeekQuery` | `GET /api/consumption-tax/tracker/current-week` — swallows 404 / 501 (returns `null`) so the page renders the pending empty state instead of erroring. Refetches every 5 minutes. |

Mutations live in
[`api/mutations.ts`](../../src/features/taxation/api/mutations.ts) —
`updateTaxationRuleRequest`, `generateBillsRequest`, `payBillRequest`.

## API

Read endpoints consumed (under `/api`):

- `GET /api/taxation-rules/` → list of `{ txn_type, tax_rate, default_penalty_rate, is_default }`.
- `GET /api/consumption-tax/bills` → list of `{ bill_id, period_start, period_end, status, amount }`.
- `GET /api/consumption-tax/bills/:id` → detail with `totals` + `items[]`.
- `GET /api/consumption-tax/tracker/current-week` → see Backend handoff (scaffold, may 404 today).

Write endpoints consumed:

- `PUT /api/taxation-rules/:txn_type` — body `{ tax_rate, default_penalty_rate }`.
- `POST /api/consumption-tax/bills/generate` — body `{ period_start, period_end }`.
- `POST /api/consumption-tax/bills/:id/pay`.

## Backend handoff

The current-week tracker surface depends on a new backend endpoint
that's not yet shipped. Spec lives at
[`docs/refactor/backend-handoff/tax-tracker.md`](../refactor/backend-handoff/tax-tracker.md)
— drop the same file next to the backend platform tracker
(`.scratch/task-backend-platform.md`) so the backend team picks it up
as part of Phase 0.7's incremental taxation engine work.

Until the endpoint ships:
- The CurrentWeekTracker card renders a pending empty state showing
  the active week label and a "Live accrual will appear here once the
  backend's incremental taxation ledger ships" hint.
- Bill generation + finalized bill detail still work; the entire
  pre-Batch-7 surface continues to function.

## Tests

| Test file | What it covers |
|---|---|
| `pages/TaxationRulesPage.test.tsx` | Renders one card per `TAXABLE_TXN_TYPE`; inline edit submits the fractional `tax_rate` (humanizing `7.5%` → `0.075`); invalid input surfaces the validation alert. |
| `pages/TaxTrackerPage.test.tsx` | Bills list renders with status pills + formatted money; opening a row shows the bill detail modal with penalty breakdown by tag; tracker card falls back to pending empty state on 404; tracker card renders top-contributors when the endpoint returns data. |
| `api/billPeriod.test.ts` | Sun → Sat week range in UTC + Asia/Kolkata; preceding-week-start guard; `fractionOfWeekElapsed` returns ~0 on Sun midnight, ~1 on Sat late, ~0.5 mid-week. |

## Responsive design

- The TaxTrackerPage container caps at `max-w-5xl` with the standard
  `px-4 sm:px-6 lg:px-8` rhythm; bill rows wrap their action cluster
  at narrow viewports.
- The bill detail table sits inside `overflow-x-auto` with a
  `min-w-[44rem]` floor so the per-txn rows don't squash; below `sm`
  the whole table scrolls horizontally inside its card.
- TaxationRulesPage cards stack to a single column at `<sm` and
  two-column at `sm+`; rate inputs are `inputMode="decimal"` for
  better mobile keyboards.
- CurrentWeekTracker stat grid is `grid-cols-2 sm:grid-cols-4`; the
  per-tag list is single-column at every viewport (chip-style rows).
- Touch targets ≥ 44 px on every primary control (`btn-primary` +
  Edit affordance); status pill is decorative, not interactive.

## URL state

- Bill detail modal: `/consumption-tax?view=<bill_id>`. Reload-safe;
  the `useUrlValueModal('view')` hook surfaces the id back into
  `<BillDetailDialog billId={n} />`.

The Generate Bills card is intentionally **not** URL-state-synced —
it's a transient input panel that lives at the top of the page; users
expect it to reset on reload.

## Future polish (queued)

- Backend-sourced projections — once the live ledger lands, the
  projection numbers will come from the backend rather than the
  client-side `safeDivide(runningTax, fractionOfWeekElapsed(...))`
  fallback the tracker uses today.
- Bill-detail download — a CSV/PDF export action for accountants.
  Not in scope for Batch 7; flag if user requests.
- Settings shell integration — Batch 9 wraps `/settings/taxation-rules`
  in the shared `SettingsLayout` sidebar; the page itself needs no
  changes to slot in (it already lives at the canonical URL).
- **User-preferred date format integration (Batch 9.5).** Bill dates
  default to **`dd/mon/yyyy`** (e.g. `15/Feb/2026`) via
  `api/billPeriod.ts:formatBillDate` — a single-file swap point.
  When Batch 9.5's `/account/preferences` page ships the
  user-persisted date-format override (tracked in
  implementation_plan "Defaults cluster persistence"), replace the
  hardcoded `{day:'2-digit', month:'short', year:'numeric'}`
  pattern with a lookup from `usePreferencesStore.dateFormat`. The
  helper is intentionally isolated so the swap is one diff. Native
  `<input type="date">` controls continue to use the browser
  locale's format — they're picker UIs, not display strings, and
  the underlying value is always ISO `YYYY-MM-DD`.
