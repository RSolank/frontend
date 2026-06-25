# Dashboard feature

> Cross-feature aggregator surface — the authenticated home. Owns
> `/dashboard` and renders a narrative, zoned glance view over every major
> feature (taxation/treasury, budgets, transactions, recurring). Lives at
> [`src/features/dashboard/`](../../src/features/dashboard/).

## Purpose

- Render `/dashboard` as the post-login home — the user lands here after
  login, after a tab refresh on any authenticated route, and via the TopNav
  brand link.
- Answer four questions in priority order, top→bottom: **where do I stand now**
  → **what needs my attention** → **how am I trending** → **what's recent +
  coming** — without navigating into any feature page.
- Deep-link each zone to its feature page so every surface has a clear next
  step.

The dashboard owns no backend endpoints of its own — every zone reuses query
hooks from the underlying feature modules (through their public `api/`
surfaces), so the React-Query cache is shared. The feature-boundary rule
(`eslint-plugin-boundaries`) forbids importing another feature's components, so
every card here is **dashboard-owned**, composing other features only via their
`api/` hooks + the shared primitives.

## Pages

| Path         | Component                 | Notes                                          |
| ------------ | ------------------------- | ---------------------------------------------- |
| `/dashboard` | `pages/DashboardPage.tsx` | Lazy-loaded. URL preserved from pre-refactor.  |

Routes are exported from
[`dashboard.routes.tsx`](../../src/features/dashboard/dashboard.routes.tsx) and
composed into the root router by `src/app/routes.tsx` (wrapped by
`protectedRoutes()`). The page is a lazy chunk and delegates all header chrome
to the shared `<TopNav />`.

## Composition — the four zones

`DashboardPage` lays the zones in a single `flex flex-col gap-6` column and
choreographs a gentle staggered entrance (see [Motion](#motion)).

### ❶ Hero — `components/hero/DashboardHero.tsx`

The signature surface, **swapped by taxation mode** (`useTaxModeStore`):

| Mode            | Hero content                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| `auto` / `manual` | `ProvisionHeroCard` (left) + `SavingsHeroCard` (right), a 2-up grid.        |
| `off`           | `SpendHeroCard` (full width) — Aevum reads as a plain expense tracker.       |

| Card                            | Hook(s)                                              | Content                                                                                                        |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `hero/ProvisionHeroCard.tsx`    | `useTrackerCurrentWeekQuery`                         | Accrued self-tax this week (count-up) → projection to Sunday → week-progress bar. The signature provision metric. Stale-week guard (manual mode) drops the projection. |
| `hero/SavingsHeroCard.tsx`      | `useTreasurySummaryQuery` (treasury `api/`)          | Funded balance (count-up, emerald) → coverage of the levied provision → this-week delta → compact emerald set-aside spark. Deep-links to the Savings page. |
| `hero/SpendHeroCard.tsx`        | `useBudgetStatusQuery` + `useExpenseTrendQuery`      | This month's spend (count-up) → budget headroom → weekly spend spark. The off-mode lead. |

Shared hero chrome: `hero/HeroShell.tsx` (panel + eyebrow + optional deep-link)
and `hero/HeroNumber.tsx` (the count-up money figure — see [Motion](#motion)).

### ❷ Needs attention — `components/NeedsAttentionRail.tsx`

One prioritized rail that **merges** the three alert surfaces the old dashboard
scattered (breach alerts, overdue bills, the tax-mode banner). Priority
top→bottom: overdue bills (money owed) → budget breaches → the tax-mode nudge.

**Renders nothing when all-clear** — zero DOM when there's no breach, no overdue
bill, and auto-finalize is on. The loud `tax_mode_auto_disabled` notice only
shows in `manual` mode (an `off` user opted out deliberately). Composes
`useBudgetStatusQuery` (budgets `api/`) + `useDomainActivityQuery('taxation')` +
`useTaxModeStore`.

### ❸ Analytics — `components/analytics/AnalyticsZone.tsx`

The counterpart of the hero swap:

| Mode              | Zone content                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| `auto` / `manual` | `SpendAnalyticsCard` — weekly spend trend (`MiniBars`/`MiniLine`) + category donut (`MiniDonut`) + `BudgetSignal` pills on the top categories. |
| `off`             | `ProvisionSavingsPlaceholder` — a calm, **dataless** re-enable nudge (the spend story has been promoted to the hero). |

`SpendAnalyticsCard` composes `useBudgetStatusQuery` + `useExpenseTrendQuery` +
the shared chart primitives + `shared/lib/budgetSignal` (the spend classifier,
relocated from `features/budgets/lib` to `shared/lib` so both surfaces classify
identically — the budgets copy now re-exports it). Donut math lives in the pure,
unit-tested `analytics/spendDonut.ts`.

### ❹ Activity & forecast — the `dashboard-activity-zone` grid

`TransactionsCard` (recent + week-bounded) beside `UpcomingBillsWidget`. The
upcoming-bills widget (`GET /recurring/upcoming?days=7`) **is** the recurring
forecast — one source, no separate "recurring forecast" card (>7 days forward
has no glance value; the widget's "Manage" link goes to the full `/recurring`
page for the 30-day view).

Both cards follow the **pure-`View` split**: the fetching container computes its
data, then renders an exported presentational `TransactionsCardView` /
`UpcomingBillsView`. That's what the **landing showcases** mount with fabricated
fixtures (no drift) — the upcoming-bills card replaced the old static
`recurring-forecast.png` screenshot there.

Both Views take a **`displayOnly`** prop for that landing mount: the navigating
affordances (Transactions' "Add" + "View all", upcoming-bills' "Manage") stay
**visible with their shared styling** (so they can't drift from the real
widgets) but render **inert** — spans, not links/buttons, with `pointer-events-none`.
The "View all" footer goes inert via `DashboardCard`'s **`footerAsText`** prop;
the inline CTAs share a single `*_CLASS` constant between the live `<Link>`/`<button>`
and the display-only `<span>`.

### Shared chrome

`components/DashboardCard.tsx` exports `<DashboardCard>` + `<DashboardCardEmpty>`,
still used by `TransactionsCard` (and `DashboardCardEmpty`'s friendly empty
interior).

## Motion

The dashboard is the **first consumer of the app-wide motion foundation**
(`src/shared/motion/`, see [conventions.md](../conventions.md#motion)):

- **`MotionProvider`** (LazyMotion + MotionConfig) is mounted **app-wide** in
  `app/providers.tsx` (hoisted 2026-06-25 — the dashboard's original
  dashboard-local mount moved up once motion became app-wide infrastructure).
  The dashboard just consumes it.
- **Two-beat entrance** — the zones fade/rise via `<Stagger>/<StaggerItem>`
  (`motion.*` forbidden — LazyMotion `strict`); then, a beat after each card
  lands, its **in-card data animates**: hero count-ups (`HeroNumber` /
  `<CountUpNumber>`, incl. "projected by Sunday"), the week-progress
  `<ProgressBar>`, the analytics donut/line/bars (`useDrawIn` — the donut fills
  as one seamless body), and the recent-txn card's **summary** stats
  ("spent / debits this week" — *not* the per-row amounts, which stay static).
  The attention rail sits _outside_ the stagger so urgent signals appear
  immediately.
- **`useCountUp`** is framer-free (a tiny rAF loop), so count-ups carry no
  animation-library weight. They animate only inside the stagger (the second
  beat) and snap when not orchestrated / under reduced motion.
- **Reduced motion** — both the in-app toggle (`useMotionStore`) and the OS
  `prefers-reduced-motion` collapse all of the above; count-ups snap to their
  final value, so numbers are correct on first paint regardless. Content is
  always fully rendered — motion never gates the paint.

## Hooks

The dashboard owns the expense-trend hook (the endpoint is dashboard-shaped);
every other query is consumed from the feature module it reads, through that
module's public `api/` surface.

| Hook                                      | Feature module                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `useExpenseTrendQuery`                    | `features/dashboard/api/queries.ts` (this module — also consumed by `/budgets`) |
| `useTreasurySummaryQuery`                 | `features/treasury/api/queries.ts`                                              |
| `useTransactionsQuery`                    | `features/transactions/api/queries.ts`                                          |
| `useBudgetStatusQuery`                    | `features/budgets/api/queries.ts`                                               |
| `useTrackerCurrentWeekQuery`              | `features/taxation/api/queries.ts`                                              |
| `useRecurringUpcomingQuery`               | `features/recurring/api/queries.ts`                                             |
| `useDomainActivityQuery`                  | `shared/api/activityFeed.ts`                                                     |
| `useTaxModeStore`                         | `shared/state/taxMode.store.ts`                                                  |
| `useCountUp` / `MotionProvider`           | `shared/motion`                                                                  |
| `weekRangeInTz` / `fractionOfWeekElapsed` | `features/taxation/api/billPeriod.ts`                                            |

`usePreferencesStore.currency` + `.timezone` are the source of truth for money +
date rendering across every card.

## API

- `GET /api/v1/expense-tracker` — per-(tag, bucket) spend trend (T-aggregates-
  engine), consumed by the hero/analytics sparks + the `/budgets` SpendTrendCard.
- `GET /api/v1/treasury/summary` — the set-aside view (T-treasury, reconcile-on-
  read) backing the Savings hero.

Every other zone consumes the `/transactions`, `/budget-limits/status`,
`/consumption-tax/…`, and `/recurring/upcoming` endpoints the feature pages call;
React Query dedupes across zones.

## Filtering / display rules

- **Active week** — every "this week" surface uses `weekRangeInTz` in the user's
  tz (ISO 8601, Mon → Sun — [ISO week convention](../conventions.md#week-convention)).
- **Month boundary edge case** — `TransactionsCard` falls back to an unbounded
  fetch when the active week straddles a month boundary.
- **Breach detection** — a category is over budget when
  `current_net_expense > limit_amt > 0`. No-limit categories are never breaches.
- **Coverage** — `funded_balance / provisioned_total`; `—` when nothing has been
  provisioned (ratio undefined, not 0%).

## Responsive design

- Page container `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8`; zones in a
  single `flex flex-col gap-6` column.
- Hero 2-up grid `lg:grid-cols-2`; activity zone `lg:grid-cols-2`; both stack on
  mobile. All interactive controls keep a ≥ 44 px tap target.

## Dark mode

Every text/border/bg utility carries a `dark:` variant; money values carry
`class="money"` for privacy-mask compatibility; the off-mode placeholder uses a
dashed border to read as a calm, dataless state.

## Tests

| Test file                                        | What it covers                                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/DashboardPage.test.tsx`                   | Welcome heading + week label; auto-mode hero (provision + savings, balance from `/treasury/summary`) + analytics + activity zones; attention rail shows on breach / hides when clear; off-mode swap (spend hero up, savings demoted to the placeholder, analytics zone gone, tax-mode nudge shown). |
| `components/hero/DashboardHero.test.tsx`         | The mode swap across auto / manual / off + the hero count-up figures (provision accrued, savings balance, coverage, off-mode spend / %).        |
| `components/NeedsAttentionRail.test.tsx`         | Renders nothing when all-clear; surfaces breaches / overdue bills / the tax-mode nudge; loud auto-disabled notice in manual but not in off.     |
| `components/UpcomingBillsWidget.test.tsx`        | 7-day forecast render, "more in /recurring" cap hint, empty + populated branches.                                                              |
| `shared/motion/useCountUp.test.tsx`             | Reduced-motion snap, changed-target snap, animate-to-target, no-overshoot.                                                                      |

## Future polish (queued)

- **Personalization / drag-to-reorder zones** — out of scope by design.
- **Bill-state counts** in the provision hero chip once the bill-state-machine FE
  wiring lands.
