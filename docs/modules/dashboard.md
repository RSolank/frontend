# Dashboard feature

> Cross-feature aggregator surface — the authenticated home. Owns
> `/dashboard` and renders a glance view of every major feature
> (Transactions, Expense Tracker, Tax Tracker) plus a secondary
> widgets cluster on desktop. Lives at
> [`src/features/dashboard/`](../../src/features/dashboard/).

## Purpose

- Render `/dashboard` as the post-login home — the user lands here
  after login, after a tab refresh on any authenticated route, and
  via the TopNav brand link (Batch 6.5 wired the brand → `/dashboard`
  when authenticated).
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

Before Batch 8.5 this surface lived as `src/pages/Dashboard.jsx`
(562 lines of inline-styled JSX, raw `apiFetch`, with its own user
menu and header chrome inline). The move splits the page into a
lazy chunk + delegates all header chrome to the shared
`<TopNav />` from Batch 6.5.

## Composition

### Primary cards (always visible)

Three glance cards arranged as `grid-cols-1 lg:grid-cols-3`. Each
card is `h-full` so the row aligns at every viewport even when one
card is in its empty state.

| Card | Hook(s) | Content |
|---|---|---|
| `components/TransactionsCard.tsx` | `useTransactionsQuery` (recent + week-bounded) | Weekly stat strip (spend + debit count) → 5 most recent rows → "Add transaction" inline CTA → footer link to `/transactions`. |
| `components/ExpenseTrackerCard.tsx` | `useBudgetStatusQuery(null)` + (Batch 9.5) `useTransactionsQuery` + `useTagsQuery` | Total Spent / Limit rollup with gradient progress bar → top 3 monthly categories with mini progress bars → **week-by-category strip** (top 3 tags by spend this week, aggregated client-side from the same weekly transactions slice TransactionsCard uses; React Query dedupes the fetch) → breach count chip when any category is over → footer link to `/budgets`. |
| `components/TaxTrackerCard.tsx` | `useTrackerCurrentWeekQuery` | Accrued + projected stat pair → week progress bar → top 3 contributors → footer link to `/consumption-tax`. |

Empty states (fresh signup) — each card shows a friendly headline
+ body copy + primary CTA routing to the relevant feature page
(with the appropriate `?add=true` / `?edit=…` modal trigger where
applicable). See the per-card source for the exact copy.

### Secondary widgets (always visible, ordered by priority)

Three smaller cards in `grid-cols-1 lg:grid-cols-3` that cluster
cross-feature signals. They reuse the same query slices as the
primary cards, so no extra network cost.

Ordered by priority (left → right on desktop, top → bottom on
mobile) so the most actionable signal lands first either way.
Per the Batch 8.5 design lock, the dashboard only carries signal
worth glancing at — what's worth desktop space is worth mobile
space too.

| Widget | Notes |
|---|---|
| `components/BreachAlertsWidget.tsx` | Lists every category currently over its monthly limit (sorted by % over). Renders nothing when no breaches exist — empty space beats an empty alert. |
| `components/WeekSummaryWidget.tsx` | "This week" mini-summary — date range + spend + debit count + tax accrued. |
| `components/RecentActivityWidget.tsx` | Placeholder card. A unified activity feed doesn't exist on the backend yet — see [`task-handoff-fe-to-be.md`](../../../.scratch/task-handoff-fe-to-be.md) for the queued request. |

### Shared chrome

`components/DashboardCard.tsx` exports two helpers used by every
primary card:

- `<DashboardCard title titleChip footerHref footerLabel pending>` —
  the chrome (border + header + footer slot). `pending` flips to a
  dashed border for empty states.
- `<DashboardCardEmpty headline body ctaHref ctaLabel>` — the
  friendly empty-state interior (icon-less per the Batch 8.5 design
  choice — copy + CTA, no illustration).

## Hooks

Dashboard owns no hooks of its own — every query consumed lives in
the feature module it pulls data from:

| Hook | Feature module |
|---|---|
| `useTransactionsQuery` | `features/transactions/api/queries.ts` |
| `useBudgetStatusQuery` | `features/budgets/api/queries.ts` |
| `useTrackerCurrentWeekQuery` | `features/taxation/api/queries.ts` |
| `useCurrenciesQuery` | `features/metadata/api/queries.ts` |
| `weekRangeInTz` / `fractionOfWeekElapsed` | `features/taxation/api/billPeriod.ts` |

`usePreferencesStore.currency` + `.timezone` are the source of
truth for money + date rendering across every card; the dashboard
feature does not define its own preferences.

## API

No new endpoints. The dashboard consumes the same `/api/transactions`,
`/api/budget-limits/status`, and `/api/consumption-tax/...`
endpoints the feature pages call. React Query dedupes the requests
across cards.

## Filtering / display rules

- **Active week** — every "this week" surface uses `weekRangeInTz`
  in the user's tz (Sun → Sat). The TransactionsCard + WeekSummaryWidget
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
  `current_expense > limit_amt > 0`. Categories with no limit are
  never counted as breaches regardless of spend.

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
  with an Add transaction CTA. Once the Phase 0.7 endpoint ships
  (see [`task-handoff-be-to-fe.md §1`](../../../.scratch/task-handoff-be-to-fe.md))
  the populated path takes over automatically.

## Responsive design

- Page container: `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6
  lg:px-8`. Wider than feature pages (`max-w-5xl`) so the 3-column
  primary grid breathes on desktop.
- Primary grid: `grid-cols-1 lg:grid-cols-3 items-stretch` so cards
  align in a row at `lg+`, stack on mobile.
- Secondary grid: `grid-cols-1 lg:grid-cols-3` — always visible.
  Priority order (BreachAlerts → WeekSummary → RecentActivity)
  flows left-to-right on desktop and top-to-bottom on mobile via
  the same grid; mobile keeps every signal the desktop carries.
- All interactive controls (CTAs, links) keep a ≥ 44 px tap target.

## Dark mode

- Every text/border/bg utility carries a `dark:` variant. Saturated
  fills on progress-bar inners (`bg-indigo-500`, `bg-emerald-500`)
  read well in both themes — mirrors the pattern in
  `BudgetCategoryCard` and `CurrentWeekTracker`.
- Money values carry `class="money"` for privacy-mask compatibility
  per CONTRIBUTING.md §6. Non-money values (counts) opt out of the
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

## Future polish (queued)

- **Activity feed** — file logged in
  [`task-handoff-fe-to-be.md §4`](../../../.scratch/task-handoff-fe-to-be.md).
  Once the backend ships a unified events endpoint, swap the
  `RecentActivityWidget` placeholder for a real list.
- **Statement-upload dock widget** — backend §3.3 in the FE handoff
  (post-refactor). When the async upload pipeline ships, this is
  where the in-flight job progress lives.
- **Personalization / drag-to-reorder cards** — out of scope per
  the Batch 8.5 brief.
- **Bill state surfacing** — once Phase 0.7's 5-state bill
  lifecycle lands, the Tax Tracker card can surface ACCRUING /
  BILLED / OVERDUE counts in the title chip.
