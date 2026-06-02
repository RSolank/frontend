# Budgets feature (Expense Tracker)

> Mirrors `backend/app/modules/budgets`. Owns the **Expense Tracker**
> surface (per-tag monthly budget limits + spend aggregates + breach
> penalties). Lives at
> [`src/features/budgets/`](../../src/features/budgets/).

## Purpose

- Render `/budgets` as the Expense Tracker page — a month-scoped
  view of every category with spend (or a configured limit), each
  shown as a card with the current month's expense, the configured
  limit, the rolling avg/min/max, and a progress bar that paints red
  when spend exceeds the limit.
- Configure budget limits + per-budget penalty-rate overrides via a
  modal-first form (`<BudgetFormDialog />`). The same modal handles
  the global "Total Budget" surface — different tag id, same shape.
- Own the `/api/v1/budget-limits/*` query / cache key namespace
  (`budgetKeys` in
  [`api/keys.ts`](../../src/features/budgets/api/keys.ts)).

## Pages

| Path | Component | Notes |
|---|---|---|
| `/budgets` | `pages/ExpenseTrackerPage.tsx` | Lazy-loaded. URL preserved per the labels-rename-URLs-stay rule; nav label is "Expense Tracker" (the URL stays `/budgets`). |

Routes are exported from
[`budgets.routes.tsx`](../../src/features/budgets/budgets.routes.tsx)
and composed into the root router by `src/app/routes.tsx` (the page is
wrapped by `protectedRoutes()`).

## Components

- `pages/ExpenseTrackerPage.tsx` — page-level surface. Hosts the
  month-picker (`<select>` keyed on `available_months`), the Total
  Budget card (emphasis variant), the categories grid, and the
  `<BudgetFormDialog />` instance. URL-state-synced via
  `useUrlValueModal('edit')` so `/budgets?edit=<tag_id>` is
  shareable + reload-safe.
- `components/BudgetCategoryCard.tsx` — read-only card rendering
  label/value pairs (Spent / Limit / Avg / Min-Max) + a progress
  bar + a penalty-rate footnote. Top-line Edit affordance ("Set
  budget" when no limit; "Edit budget" otherwise). The same
  component renders the Total Budget surface with `emphasis` set,
  which paints an indigo-tinted background to mark it as the
  top-level rollup. Carries an **anomaly badge** inline with the title
  that classifies the current month's spend
  against `avg_net_expense` / `max_net_expense` into four bands —
  `Below typical` (emerald, current ≤ avg×0.75),
  `Typical` (slate, within ±25 % of avg),
  `Near typical max` (amber, > avg×1.25 and ≤ max), and
  `Above typical max` (rose, > max). The badge is hidden when no
  historical baseline exists yet (`avg_net_expense ≤ 0`).
- `components/BudgetFormDialog.tsx` — `<Modal size="md">` with two
  fields: Monthly limit (numeric, in active currency) and Penalty
  rate (humanized — accepts `5%`, `0.05`, `5`). Save calls
  `POST /api/v1/budget-limits/` (backend upsert by `tag_id + period`).
  Cancel + Save in footer; confirmOnDirty on close.
- `components/ExpenseTrendChart.tsx` — six-month
  `<svg>` bar chart of the Total tag's `net_expense`. Reads
  `useExpenseTrendQuery('monthly', 6, TOTAL_TAG_ID)` from the
  dashboard feature's `api/queries.ts`. Inline SVG (no chart-lib
  dep — recharts would punch the bundle ceiling). Slots between
  the Month Overview rollup and the Categories grid.

## Hooks

| Hook | Purpose |
|---|---|
| `useBudgetStatusQuery(month)` | `GET /api/v1/budget-limits/status?month=<YYYY-MM>` → merged report with `categories[]`, `total_budget`, `month`, and `available_months[]`. |
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
  default_penalty_rate), `total_budget` (same shape, tag_id =
  `TOTAL_TAG_ID`), `currency`, `month`, `available_months[]`.
  BE Phase 1.7 (`3252ca4`, T-aggregates-engine) renamed the spend
  family to `net_expense = total_debit − total_credit` (expense-
  positive — refunds net spend down).
- `GET /api/v1/budget-limits/?budget_period=monthly` → list of
  configured limits (no spend aggregates).
- `GET /api/v1/expense-tracker?period_type=monthly&n=6&tag_id=<TOTAL>` →
  per-bucket trend for the `<ExpenseTrendChart>` six-month chart.
  Query hook lives in
  [`features/dashboard/api/queries.ts`](../../src/features/dashboard/api/queries.ts)
  because two consumers (this page + future dashboard widget)
  share it; see [`dashboard.md`](dashboard.md).

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
- The Total Budget card always renders when the backend returns one;
  it sits above the categories grid with the `emphasis` variant.

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

| Test file | What it covers |
|---|---|
| `api/rateInput.test.ts` | `formatRateForInput` and `parseRateInput` — fraction → `%` display, `%`-suffix parsing, bare ≥1 lenient mode, raw fraction passthrough, invalid input → null. |
| `pages/ExpenseTrackerPage.test.tsx` | Renders the Total card + filtered category cards; cards expose no input controls (read-only enforcement); Edit / Set affordance opens the modal with prefilled values; over-budget pill renders for the discretionary case; save POST body shape is correct; month picker switches the active month query param. |
| `components/ExpenseTrendChart.test.tsx` | Six-month SVG bar chart render against `useExpenseTrendQuery` output; empty + populated branches. |

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
- The Total Budget card uses `bg-indigo-50/60 dark:bg-indigo-950/30`
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
