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
- Own the `/api/v1/taxation-rules` and `/api/v1/consumption-tax/*` query /
  cache key namespaces (`taxationKeys` in
  [`api/keys.ts`](../../src/features/taxation/api/keys.ts)).

## Pages

| Path | Component | Notes |
|---|---|---|
| `/consumption-tax` | `pages/TaxTrackerPage.tsx` | Lazy-loaded. URL preserved from the pre-refactor; the nav label is "Tax Tracker" per the rename-labels-not-URLs rule. |
| `/settings/taxation-rules` | `pages/TaxationRulesPage.tsx` | Lazy-loaded. Lives at its canonical URL inside the Settings shell. |

Routes are exported from
[`taxation.routes.tsx`](../../src/features/taxation/taxation.routes.tsx)
and composed into the root router by `src/app/routes.tsx`
(both pages are wrapped by `protectedRoutes()`).

## Tax Tracker (current-week card)

The current-week tracker card calls
`GET /api/v1/consumption-tax/tracker/current-week` for:

- `running_tax` / `running_penalty` — sum of tax / penalty accrued for
  in-progress week's transactions.
- `projected_tax` / `projected_penalty` — backend-supplied or
  client-derived linear projection.
- `per_tag[]` — top contributing tags for the in-progress week.

The endpoint shipped in BE Phase 2.6 (`e7c05aa`); the 404 / 501 path is
kept as a defensive fallback so accounts with zero accrual still render
a friendly empty state with the active week label rather than an error.

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
  available types. Save calls `PUT /api/v1/taxation-rules/:txn_type`
  (upsert — see backend handoff for why no POST is needed).
- `components/GenerateBillsDialog.tsx` — modal-first generation
  surface. Week-picker or date-range mode; computes ISO Mon→Sun
  boundaries in the user's tz (per the project-wide week
  convention — see [`docs/conventions.md`](../conventions.md#week-convention));
  blocks generation for periods ending at-or-after
  `precedingWeekStart`.
- `components/CurrentWeekTracker.tsx` — running-tax card with status
  stats, a week-progress bar, and a top-5 per-tag breakdown. Falls
  back to a "pending" empty state when the endpoint 404s.
- `components/BillDetailDialog.tsx` — `<Modal size="xl">` wrapper for
  the bill detail surfaces. Items table renders **Date / Beneficiary
  / Type / Amount / Tax / Penalty / Penalty tag**. BE Phase 2.6
  splits the items into a real-transactions table + a separate
  **Adjustments** section for `is_adjustment=true` rows (corrections
  to past finalized bills that landed on the current ACCRUING bill
  per Decision 23). The header strip shows the per-state pill and
  the `amount_paid / amount` progress when partial. When the bill is
  in a settleable state (`BILLED` / `OVERDUE`) and the caller passes
  `onMarkPaid`, a **Mark paid** action appears in the footer; for
  `PAID` bills the inverse **Reopen** action surfaces via
  `onMarkUnpaid`.
- `components/billStatus.tsx` — shared bill-state visual treatment:
  `BillStatusPill`, `billStatusDescriptor`, `isPayable`, and
  `isUnpayable` helpers. Used by both the page row and the detail
  dialog so the icon + colour + label are identical across surfaces.
- `state/taxMode.store.ts` and the matching
  `shared/components/TaxModeToggle` — the `auto_enabled` toggle UI.
  Store lives in `shared/state/` to match the rest of the
  preference-store cluster; toggle in `shared/components/` so the
  `/account/preferences` page can compose it across the feature
  boundary. Hydrated + PATCHed via the existing
  `hydratePreferences()` + `subscribeToPreferenceStores()` pipeline.

## Hooks

| Hook | Purpose |
|---|---|
| `useTaxationRulesQuery` | `GET /api/v1/taxation-rules/` → `{ rules[] }`. |
| `useBillsQuery` | `GET /api/v1/consumption-tax/bills` → `{ bills[] }`. |
| `useBillQuery(billId)` | Lazy `GET /api/v1/consumption-tax/bills/:id` — only fires when `billId != null`. |
| `useTrackerCurrentWeekQuery` | `GET /api/v1/consumption-tax/tracker/current-week` — swallows 404 / 501 (returns `null`) so the page renders the pending empty state instead of erroring. Refetches every 5 minutes. |

Mutations live in
[`api/mutations.ts`](../../src/features/taxation/api/mutations.ts) —
`updateTaxationRuleRequest`, `generateBillsRequest`,
`markBillPaidRequest`, `markBillUnpaidRequest`. (`payBillRequest`
was removed in Platform FE Batch 8 — BE Phase 2.6 deleted the
`pay_bill` endpoint per Decision 25.)

## API

Read endpoints consumed (under `/api`):

- `GET /api/v1/taxation-rules/` → list of `{ txn_type, tax_rate, default_penalty_rate, is_default }`.
- `GET /api/v1/consumption-tax/bills` → list of `{ bill_id, period_start, period_end, status, amount, amount_paid, billed_at?, due_date?, paid_at?, last_modified? }`. The `status` enum is the 5-state machine (`ACCRUING | BILLED | PAID | OVERDUE | EXPIRED`); the old 2-state `'pending' | 'paid'` shape was retired in BE Phase 2.6.
- `GET /api/v1/consumption-tax/bills/:id` → bill summary + `totals` + `items[]` (with `is_adjustment` + `adjustment_for_bill_id` per Decision 23) + `allocations[]` (manual / auto-FIFO).
- `GET /api/v1/consumption-tax/tracker/current-week` → see Backend handoff (scaffold, may 404 today).

Write endpoints consumed:

- `PUT /api/v1/taxation-rules/:txn_type` — body `{ tax_rate, default_penalty_rate }`.
- `POST /api/v1/consumption-tax/bills/generate` — body `{ period_start, period_end }`.
- `POST /api/v1/consumption-tax/bills/:id/mark-paid` — body `{ payment_txn_id?, amount? }` (BE Phase 2.6, Decision 25).
- `POST /api/v1/consumption-tax/bills/:id/mark-unpaid` — no body. The undo path.

Preferences:

- `auto_enabled` on `/api/v1/users/preferences` — taxation auto-mode
  toggle (Decision 26). Wired via the existing preference-store
  pipeline; the toggle lives on
  [`/account/preferences`](account.md).

## Tests

| Test file | What it covers |
|---|---|
| `pages/TaxationRulesPage.test.tsx` | Renders one card per `TAXABLE_TXN_TYPE`; inline edit submits the fractional `tax_rate` (humanizing `7.5%` → `0.075`); invalid input surfaces the validation alert. |
| `pages/TaxTrackerPage.test.tsx` | Bills list renders with the 5-state status pills + formatted money + the per-row Mark paid / Reopen action gated on state; opening a row shows the bill detail modal with penalty breakdown by tag; `bill-modal-mark-paid` POSTs to `/mark-paid`; adjustment rows render in a separate `bill-adjustments` section; tracker card falls back to pending empty state on 404; tracker card renders top-contributors when the endpoint returns data. |
| `components/billStatus.test.tsx` | Per-state pill renders the human label; `isPayable` / `isUnpayable` predicates gate on the right states. |
| `shared/components/TaxModeToggle.test.tsx` | Toggle reflects + flips the `useTaxModeStore` value; helper copy adapts to the new state. |
| `api/billPeriod.test.ts` | ISO Mon → Sun week range in UTC + Asia/Kolkata; preceding-week-start guard; `fractionOfWeekElapsed` returns ~0 at the start of Monday, ~1 at the end of Sunday, ~0.5 mid-week. |

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

- Drop the client-side projection fallback — BE Phase 2.6 ships
  `projected_tax` / `projected_penalty` on the tracker payload, but
  the tracker still falls back to
  `safeDivide(runningTax, fractionOfWeekElapsed(...))` when those
  fields are `0`. Once the ledger reliably emits non-zero
  projections mid-week we can delete the fallback.
- Bill-detail download — a CSV/PDF export action for accountants.
  Not yet implemented; flag if requested.
- **User-preferred date-format override.** Bill dates
  default to **`dd/mon/yyyy`** (e.g. `15/Feb/2026`) via
  `api/billPeriod.ts:formatBillDate` — a single-file swap point.
  Once a user-persisted date-format preference is available (it needs
  the backend defaults-cluster columns — a deferred backend follow-up),
  replace the hardcoded `{day:'2-digit', month:'short', year:'numeric'}`
  pattern with a lookup from `usePreferencesStore.dateFormat`. The
  helper is intentionally isolated so the swap is one diff. Native
  `<input type="date">` controls continue to use the browser
  locale's format — they're picker UIs, not display strings, and
  the underlying value is always ISO `YYYY-MM-DD`.
