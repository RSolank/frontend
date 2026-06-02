# Dashboard feature

> Cross-feature aggregator surface — the authenticated home. Owns
> `/dashboard` and renders a glance view of every major feature
> (Transactions, Expense Tracker, Tax Tracker) plus a secondary
> widgets cluster on desktop. Lives at
> [`src/features/dashboard/`](../../src/features/dashboard/).

## Purpose

- Render `/dashboard` as the post-login home — the user lands here
  after login, after a tab refresh on any authenticated route, and
  via the TopNav brand link (the brand routes → `/dashboard` when
  authenticated).
- Surface enough at-a-glance signal that the user can answer "what
  did I spend, how close am I to a breach, what's my current tax
  burden" without navigating into any feature page.
- Deep-link to each feature page (and to its modal-first CRUD entry
  points) so every card has a clear "next step" affordance.

The dashboard owns no backend endpoints of its own — every card
reuses query hooks from the underlying feature modules so the
React-Query cache is shared (the user pre-loads `/transactions`,
`/budgets`, `/consumption-tax` content while sitting on the
dashboard).

## Pages

| Path | Component | Notes |
|---|---|---|
| `/dashboard` | `pages/DashboardPage.tsx` | Lazy-loaded. URL preserved from pre-refactor. |

Routes are exported from
[`dashboard.routes.tsx`](../../src/features/dashboard/dashboard.routes.tsx)
and composed into the root router by `src/app/routes.tsx` (wrapped
by `protectedRoutes()` like every authenticated surface).

The page is a lazy chunk and delegates all header chrome to the shared
`<TopNav />`.

## Composition

### Primary cards (always visible)

Three glance cards arranged as `grid-cols-1 lg:grid-cols-3`. Each
card is `h-full` so the row aligns at every viewport even when one
card is in its empty state.

| Card | Hook(s) | Content |
|---|---|---|
| `components/TransactionsCard.tsx` | `useTransactionsQuery` (recent + week-bounded) | Weekly stat strip (spend + debit count) → 5 most recent rows → "Add transaction" inline CTA → footer link to `/transactions`. |
| `components/ExpenseTrackerCard.tsx` | `useBudgetStatusQuery(null)` + `useTransactionsQuery` + `useTagsQuery` | Total Spent / Limit rollup with gradient progress bar → top 3 monthly categories with mini progress bars → **week-by-category strip** (top 3 tags by spend this week, aggregated client-side from the same weekly transactions slice TransactionsCard uses; React Query dedupes the fetch) → breach count chip when any category is over → footer link to `/budgets`. |
| `components/TaxTrackerCard.tsx` | `useTrackerCurrentWeekQuery` | Accrued + projected stat pair → week progress bar → top 3 contributors → footer link to `/consumption-tax`. |

Empty states (fresh signup) — each card shows a friendly headline
+ body copy + primary CTA routing to the relevant feature page
(with the appropriate `?add=true` / `?edit=…` modal trigger where
applicable). See the per-card source for the exact copy.

### Secondary widgets (always visible, ordered by priority)

Four smaller cards in `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`
that cluster cross-feature signals. They reuse the same query
slices as the primary cards, so no extra network cost. (Grid
flipped from `lg:grid-cols-3` to the current 2/4 split in Batch
11 to fit the 4th tile — UpcomingBillsWidget — cleanly across
breakpoints.)

Ordered by priority (left → right on desktop, top → bottom on
mobile) so the most actionable signal lands first either way.
By design, the dashboard only carries signal worth glancing at —
what's worth desktop space is worth mobile space too.

| Widget | Notes |
|---|---|
| `components/BreachAlertsWidget.tsx` | Lists every category currently over its monthly limit (sorted by % over). Renders nothing when no breaches exist — empty space beats an empty alert. |
| `components/WeekSummaryWidget.tsx` | "This week" mini-summary — date range + spend + debit count + tax accrued. |
| `components/UpcomingBillsWidget.tsx` | BE Phase 1.5 (`f369ce2`) — next 7 days of forecast recurring bills from `GET /api/v1/recurring/upcoming?days=7`. Capped at 5 rows with a "more in /recurring" hint when the cap clips; "Manage" button deep-links to the full `/recurring` page. Inlines its row markup (does not reuse `features/recurring/components/UpcomingBillsList`) because the eslint boundaries rule restricts dashboard to other features' `api/` surface only. |
| `components/RecentActivityWidget.tsx` | Live list backed by BE Phase 2.4 (`77cffb3`) `GET /api/v1/activity`. One row per worker / engine-originated event (bill generated, budget breached, statement import failed, …) with icon + summary + relative time. Fires `POST /api/v1/activity/seen` with `signal=soft` once per `event_id` per session (BE dedupes per cycle) and with `signal=hard` on click; FE composes its own deep-link from `subject_type` + `subject_id`. Server-ordered by `value` (decay/escalation score) — never re-sort client-side. Empty by default for new accounts (friendly empty-state copy). |

### Shared chrome

`components/DashboardCard.tsx` exports two helpers used by every
primary card:

- `<DashboardCard title titleChip footerHref footerLabel pending>` —
  the chrome (border + header + footer slot). `pending` flips to a
  dashed border for empty states.
- `<DashboardCardEmpty headline body ctaHref ctaLabel>` — the
  friendly empty-state interior (icon-less by design — copy + CTA,
  no illustration).

## Hooks

Dashboard owns the activity-feed + expense-trend hooks because the
underlying endpoints are dashboard-shaped; every other query
consumed by a card lives in the feature module it pulls data from.

| Hook | Feature module |
|---|---|
| `useActivityFeedQuery` | `features/dashboard/api/queries.ts` (this module) |
| `useExpenseTrendQuery` | `features/dashboard/api/queries.ts` (this module — also consumed by `/budgets`) |
| `useTransactionsQuery` | `features/transactions/api/queries.ts` |
| `useBudgetStatusQuery` | `features/budgets/api/queries.ts` |
| `useTrackerCurrentWeekQuery` | `features/taxation/api/queries.ts` |
| `useCurrenciesQuery` | `shared/api/referenceData.ts` |
| `weekRangeInTz` / `fractionOfWeekElapsed` | `features/taxation/api/billPeriod.ts` |

`usePreferencesStore.currency` + `.timezone` are the source of
truth for money + date rendering across every card; the dashboard
feature does not define its own preferences.

## API

Two endpoints rooted in the dashboard module (because consumers
span multiple feature pages):

- `GET /api/v1/activity` (+ `POST /api/v1/activity/seen`) — BE Phase 2.4
  (`77cffb3`). Driven through `features/dashboard/api/{queries,
  mutations,schemas}.ts`.
- `GET /api/v1/expense-tracker` — BE Phase 1.7 (`3252ca4`,
  T-aggregates-engine). Per-(tag, bucket) trend; consumed by both
  the dashboard (future widget) and the `/budgets`
  `<ExpenseTrendChart>` today.

Every other card consumes the same `/api/v1/transactions`,
`/api/v1/budget-limits/status`, and `/api/v1/consumption-tax/…` endpoints
the feature pages call. React Query dedupes the requests across
cards.

## Filtering / display rules

- **Active week** — every "this week" surface uses `weekRangeInTz`
  in the user's tz (ISO 8601, Mon → Sun — see the project-wide
  [ISO week convention](../conventions.md#week-convention)). The
  TransactionsCard + WeekSummaryWidget
  filter transactions client-side using `txn_date >= period_start`
  and `txn_date <= period_end + 'T23:59:59'` so any ISO timestamp
  inside the active week is counted.
- **Month boundary edge case** — when the active week straddles a
  month boundary the transactions card falls back to an unbounded
  (`limit: 200`) fetch instead of the `month=YYYY-MM` filter, so
  neither half is missed. Cheap insurance.
- **Top categories** — Expense Tracker card filters out any
  category with no spend AND no configured limit, then sorts by
  current spend desc, then takes the top 3. Matches the
  ExpenseTracker page's category filter (legacy parity).
- **Top contributors** — Tax Tracker card takes the first 3 of the
  backend's `per_tag` array (already sorted by `tax_amount + penalty`
  desc per the §1 contract in the BE→FE handoff).
- **Breach detection** — a category is "over budget" when
  `current_net_expense > limit_amt > 0` (BE Phase 1.7 contract:
  `net_expense = total_debit − total_credit`, expense-positive).
  Categories with no limit are never counted as breaches regardless
  of spend.

## Empty states

- **Transactions** — fresh user with zero transactions sees
  "No transactions yet" + Add CTA pointing at `/transactions?add=true`.
- **Expense Tracker** — only when both `total_budget` spend and
  every category's spend are 0 AND no limits are configured does
  the card flip to the "No budgets configured" empty. If the user
  has spend but no limits, the populated view renders with a
  "set one to track headroom" inline hint.
- **Tax Tracker** — when the backend endpoint 404s OR `data ==
  null`, renders the friendly "No tax accrual yet this week" empty
  with an Add transaction CTA. The
  `GET /api/v1/consumption-tax/tracker/current-week` endpoint shipped
  in BE Phase 2.6 (`e7c05aa`), so the populated path is live; the
  404-tolerant fallback stays for accounts with zero accrual.

## Responsive design

- Page container: `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6
  lg:px-8`. Wider than feature pages (`max-w-5xl`) so the 3-column
  primary grid breathes on desktop.
- Primary grid: `grid-cols-1 lg:grid-cols-3 items-stretch` so cards
  align in a row at `lg+`, stack on mobile.
- Secondary grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` —
  always visible. Priority order (BreachAlerts → WeekSummary →
  UpcomingBills → RecentActivity) flows left-to-right on desktop
  and top-to-bottom on mobile via
  the same grid; mobile keeps every signal the desktop carries.
- All interactive controls (CTAs, links) keep a ≥ 44 px tap target.

## Dark mode

- Every text/border/bg utility carries a `dark:` variant. Saturated
  fills on progress-bar inners (`bg-accent-500`, `bg-success-500`)
  read well in both themes — mirrors the pattern in
  `BudgetCategoryCard` and `CurrentWeekTracker`.
- Money values carry `class="money"` for privacy-mask compatibility
  per [`docs/conventions.md`](../conventions.md). Non-money values (counts) opt out of the
  `money` class so the privacy toggle doesn't blur them.
- Empty-state variant uses a dashed `border-slate-300
  dark:border-slate-700` so the "fresh signup" cards visually stand
  apart from populated ones in both themes.

## URL state

No URL params. Each card's CTAs deep-link to the destination
feature page with the appropriate query string (`?add=true`,
`?edit=<id>`) so the destination's `useUrlValueModal` picks the
modal open. Bookmark → `/dashboard` always lands on the same
overview.

## Tests

| Test file | What it covers |
|---|---|
| `pages/DashboardPage.test.tsx` | Welcome heading reads the user first name; the three primary cards render in the primary grid with the right stat values; breach chip appears when any category is over; Top-3 categories filtered + sorted; Tax Tracker renders accrued + projected + contributors; secondary widgets render with the correct stats; empty-state copy + CTAs render when each underlying dataset is empty; BreachAlertsWidget hides itself when no breach exists. |
| `components/ExpenseTrackerCard.test.tsx` | Per-card rollup of Total Spent / Limit + top 3 categories + breach chip; week-by-category strip aggregation; empty + populated branches. |
| `components/TaxTrackerCard.test.tsx` | Accrued + projected stat pair, top-3 contributors, 404-tolerant empty branch, populated state via the BE Phase 2.6 endpoint. |
| `components/UpcomingBillsWidget.test.tsx` | 7-day forecast render, "more in /recurring" cap hint, empty + populated branches. |
| `components/RecentActivityWidget.test.tsx` | Activity-feed render + `signal=soft` seen-mutation per session + `signal=hard` click-mutation. |

## Future polish (queued)

- **Personalization / drag-to-reorder cards** — out of scope by design.
- **Bill state surfacing** — once [[taxation.bill-state-machine]]
  FE wiring lands, the Tax Tracker card can surface ACCRUING /
  BILLED / OVERDUE counts in the title chip.
- **Activity feed widget promotion** — once real event volume
  shows up in `useActivityFeedQuery`, consider promoting the widget
  out of the secondary cluster (or giving it more height) so a
  busier feed reads better.
