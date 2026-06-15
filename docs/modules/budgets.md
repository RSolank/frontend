# Budgets feature (Expense Tracker)

> Mirrors `backend/app/modules/budgets`. Owns the **Expense Tracker**
> surface (per-tag monthly budget limits + spend aggregates + breach
> penalties). Lives at
> [`src/features/budgets/`](../../src/features/budgets/).

## Purpose

- Render `/budgets` as the Expense Tracker — a single analytics
  dashboard ordered by importance into three zones: **Zone 1** an
  overview card (total + state + top categories), **Zone 2** a
  spending-trend card (total bars/line beside a category-breakdown
  donut, with a stacked stats footer), and **Zone 3** the per-category
  budget cards. A casual / mobile reader gets the answer from Zone 1
  and can stop; explorers scroll for the trend and per-category detail.
  The month `<select>` is the **page anchor**: Zones 1 & 3 snapshot
  that month, Zone 2's trend ends on it. Drill-down into individual
  transactions lives on the Transactions page — here it's cumulative
  totals, trends, and state only.
- Configure budget limits + per-budget penalty-rate overrides via a
  modal-first form (`<BudgetFormDialog />`). The same modal handles
  the global "Total Budget" surface — different tag id, same shape.
- Own the `/api/v1/budget-limits/*` query / cache key namespace
  (`budgetKeys` in
  [`api/keys.ts`](../../src/features/budgets/api/keys.ts)).

## Pages

| Path       | Component                      | Notes                                                                                                                       |
| ---------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/budgets` | `pages/ExpenseTrackerPage.tsx` | Lazy-loaded. URL preserved per the labels-rename-URLs-stay rule; nav label is "Expense Tracker" (the URL stays `/budgets`). |

Routes are exported from
[`budgets.routes.tsx`](../../src/features/budgets/budgets.routes.tsx)
and composed into the root router by `src/app/routes.tsx` (the page is
wrapped by `protectedRoutes()`).

## Components

- `pages/ExpenseTrackerPage.tsx` — page-level surface. Hosts the
  month-picker page anchor (`<select>` keyed on `available_months`)
  and the three zones (`<TrackerZones>`), plus the
  `<BudgetFormDialog />` instance. URL-state-synced via
  `useUrlValueModal('edit')` so `/budgets?edit=<tag_id>` is
  shareable + reload-safe.
- `lib/budgetSignal.ts` — the **single classifier** behind the unified
  signal (replaces the old status-word + anomaly-badge pair).
  `computeBudgetSignal()` has two modes: with a limit → the budget band
  (`On track` / `Watch` / `Near limit` / `Over budget` by % of limit);
  without → the rolling-baseline band (`Below typical` / `Typical` /
  `Above typical` / `Most expensive yet`, or `No budget set` when there's
  no spend / history). `SIGNAL_STYLE` maps each tone to the existing
  semantic tokens (success / warning / orange / danger / slate).
- `components/BudgetSignal.tsx` — the pill rendering that classifier;
  the secondary dimension (rolling typical, or breach overshoot) rides
  in the tooltip. Used on the Zone 1 overview and every Zone 3 card.
- `components/SpendGauge.tsx` — the unified spend bar. With a limit →
  fill vs the limit + a threshold line, an `avg` tick, and (only when
  breached) a `max` tick. Without → fill vs the rolling max + an `avg`
  tick. `min` rides in the tooltip.
- `components/ExpenseOverviewCard.tsx` — **Zone 1** (the highlight).
  Exports a pure `ExpenseOverviewView` (total + MoM delta + BudgetSignal
  + SpendGauge + top-3 categories, Miscellaneous excluded) and a thin
  `ExpenseOverviewCard` container that wires live data + the MoM delta
  query. The landing hero imports the **View** with fabricated data so
  the mock can't drift from the app.
- `components/SpendTrendCard.tsx` — **Zone 2**. A range selector
  (1W / 1M / 3M / 6M / YTD / 1Y / 2Y, default 6M) drives two queries
  (Total series + all-tag breakdown) ending at the page anchor; renders
  bars (≤5 buckets) or a line (more) beside a category donut, with a
  stacked footer (this-window stats above rolling-12-month stats).
- `components/trendCharts.tsx` — hand-rolled inline-SVG `MiniBars` /
  `MiniLine` / `MiniDonut` primitives (no chart library — recharts would
  punch the bundle ceiling) + the categorical slice palette.
- `components/BudgetCategoryCard.tsx` — **Zone 3** read-only card:
  label/value pairs (Spent / Limit / Avg) + a `<SpendGauge>` + a
  `<BudgetSignal>` in the header + a penalty-rate footnote. Min/Max no
  longer clutter the card (they live in the Zone 2 footer). The same
  component renders the Total surface with `emphasis` set (indigo tint)
  — though the Total now headlines Zone 1, not the grid.
- `components/BudgetFormDialog.tsx` — `<Modal size="md">` with two
  fields: Monthly limit (numeric, in active currency) and Penalty
  rate (humanized — accepts `5%`, `0.05`, `5`). Save calls
  `POST /api/v1/budget-limits/` (backend upsert by `tag_id + period`).
  Cancel + Save in footer; confirmOnDirty on close. When the tag has
  a configured limit, a muted "Created on …" footer renders below
  the form fields from the BE Phase 3.0 `BudgetStatusRow.created_at`.
## Hooks

| Hook                           | Purpose                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useBudgetStatusQuery(month)`  | `GET /api/v1/budget-limits/status?month=<YYYY-MM>` → merged report with `categories[]`, `total_budget`, `month`, and `available_months[]`.                                   |
| `useBudgetLimitsQuery(period)` | `GET /api/v1/budget-limits/?budget_period=<period>` — lightweight limits-only list. Exported so the Dashboard card can pull just the limits without the full status payload. |

Mutations live in
[`api/mutations.ts`](../../src/features/budgets/api/mutations.ts) —
`upsertBudgetLimitRequest`.

## API

Read endpoints consumed (under `/api/v1/budget-limits`):

- `GET /api/v1/budget-limits/status?month=YYYY-MM` → status response with
  `categories[]` (tag_id, tag_name, tag_type, `current_debit`,
  `current_credit`, `current_net_expense`, `avg_net_expense`,
  `min_net_expense`, `max_net_expense`, limit_amt, penalty_rate,
  default_penalty_rate, `created_at`), `total_budget` (same shape,
  tag_id = `TOTAL_TAG_ID`), `currency`, `month`, `available_months[]`.
  `created_at` (BE Phase 3.0, `fc22163`) is populated when the tag
  has a configured `BudgetLimit`; null for tags with only tracker
  stats. Powers the "Created on …" footer on `<BudgetFormDialog>`.
  BE Phase 1.7 (`3252ca4`, T-aggregates-engine) renamed the spend
  family to `net_expense = total_debit − total_credit` (expense-
  positive — refunds net spend down).
- `GET /api/v1/budget-limits/?budget_period=monthly` → list of
  configured limits (no spend aggregates).
- `GET /api/v1/expense-tracker?period_type=…&n=…&tag_id=<TOTAL>&end=YYYY-MM-DD`
  → the Total-tag series for Zone 2's bars/line. Omitting `tag_id` returns
  every tag's per-bucket rows, which `SpendTrendCard` sums per tag into the
  breakdown donut. `end` (BE optional param) anchors the window's last
  bucket at the page's selected month. Query hook lives in
  [`features/dashboard/api/queries.ts`](../../src/features/dashboard/api/queries.ts)
  because multiple consumers share it; see [`dashboard.md`](dashboard.md).

Write endpoints consumed:

- `POST /api/v1/budget-limits/` — body `{ tag_id, budget_period: 'monthly',
limit_amt, penalty_rate? }`. Backend upserts by user + tag + period.
  The legacy frontend POSTed without a trailing slash; the new code
  uses the canonical `POST /` shape exposed by the backend router.
- `DELETE /api/v1/budget-limits/{tag_id}` — 204 on success. Drives the
  Remove action on `BudgetFormDialog`.

## Filtering / display rules

- The categories grid renders any category with
  `current_net_expense > 0` OR a configured `limit_amt > 0`.
  Categories with no spend AND no limit are filtered out (legacy
  behavior — keeps the grid focused on cells the user actually
  cares about).
- Categories are ordered as the backend returns them — root tags
  first, then alphabetical within each group (see
  `budget_services.list_budget_limits` ordering).
- The Total Budget headlines **Zone 1** (the overview card) when the
  backend returns one; it no longer renders as a card above the grid.

## Form semantics

- **Limit prefill** — when editing an existing budget the limit
  pre-fills with `limit_amt`. When configuring a fresh budget for a
  category with spend the limit pre-fills with `round(avg * 1.2)`
  so the user gets a believable starting point instead of `0`.
- **Penalty prefill** — falls back through `penalty_rate` →
  `default_penalty_rate` → `0.05` (legacy default).
- **Rate parser** — shared with the taxation rules dialog via
  `api/rateInput.ts`. Accepts `5%` (explicit percent), `0.05` (raw
  fraction), or `5` (bare number ≥ 1, assumed percent). The Zod
  schema's `max=10` rejects pathological inputs like a typed `500`.
- **Remove action** — `BudgetFormDialog` exposes a Remove button
  in edit mode (trash header per the DetailModal convention).
  Confirms via a nested `<ConfirmDialog />` then calls
  `deleteBudgetLimitRequest(tag_id)` → `DELETE /api/v1/budget-limits/{tag_id}`
  (BE 204). The category card flips back to its "Set budget" empty
  state once the mutation resolves.

## Tests

| Test file                               | What it covers                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/rateInput.test.ts`                 | `formatRateForInput` and `parseRateInput` — fraction → `%` display, `%`-suffix parsing, bare ≥1 lenient mode, raw fraction passthrough, invalid input → null.                                                                                                                                                    |
| `pages/ExpenseTrackerPage.test.tsx`     | Renders the Total card + filtered category cards; cards expose no input controls (read-only enforcement); Edit / Set affordance opens the modal with prefilled values; over-budget pill renders for the discretionary case; save POST body shape is correct; month picker switches the active month query param. |
| `components/ExpenseTrendChart.test.tsx` | Six-month SVG bar chart render against `useExpenseTrendQuery` output; empty + populated branches.                                                                                                                                                                                                                |

## Responsive design

- Page container caps at `max-w-5xl` with `px-4 sm:px-6 lg:px-8`.
- Categories grid switches from `grid-cols-1` to `grid-cols-2` at
  `lg+`; cards never force horizontal body scroll.
- Each card's label/value strip uses `grid-cols-2 sm:grid-cols-4` so
  the four metrics stack 2×2 on mobile and 1×4 on desktop.
- The Edit affordance keeps a ≥ 44 px tap target on all viewports.
- The month-picker `<select>` carries `min-w-[12rem]` so the chosen
  label has room to render in full at every viewport.

## Dark mode

- Every text/border/bg color carries a `dark:` variant. Auto-themed
  primitives (`.btn-primary`, `.form-input`) inherit dark-mode
  styling from `src/index.css`'s `@layer components`. The
  modal body wraps in `text-slate-700 dark:text-slate-200` so any
  inherited label or helper text stays legible.
- The Total Budget card uses `bg-accent-50/60 dark:bg-accent-950/30`
  for its emphasis variant, providing clear separation from the
  neutral category cards in both themes.
- Native widgets (the month-picker dropdown, calendar pickers used
  elsewhere) inherit the active theme via the project-wide
  `color-scheme: light` / `html.dark { color-scheme: dark }` rule.

## URL state

- Budget editor modal: `/budgets?edit=<tag_id>`. Reload-safe; the
  `useUrlValueModal('edit')` hook surfaces the id back into
  `<BudgetFormDialog category={…} />`.

## Future polish (queued)

- **Settings consolidation** — once the backend persists
  `default_landing_route` (deferred defaults-cluster follow-up), users
  who set landing to `/budgets` get this surface as their post-login home.
