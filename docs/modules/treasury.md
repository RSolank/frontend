# treasury (the "Savings" page)

> **Naming:** the user-facing label is **"Savings"**; the route, feature
> directory, API path and query keys all stay **`treasury`** — the infra name
> on the `taxation → savings → investments` spine. Maps 1:1 to the backend
> [`backend/docs/modules/treasury.md`](../../../backend/docs/modules/treasury.md).

## Purpose

The income side of the **committee's revenue books** — how much self-tax the
user's future self has actually set aside, and how it splits between revenue
recognized against a levied bill and surplus held in advance. The page reads a
single reconcile-on-read endpoint and renders three zones; it never mutates
anything. Income-side only for now — the expense (investments) side slots in
below later.

The components are kept **pure / presentational** (data + a `money` formatter
in via props) so the A1b dashboard hero can mount the headline + trend with the
same `/treasury/summary` data.

## Pages

- `pages/SavingsPage.tsx` — route **`/treasury`** (auth-gated, lazy via
  `treasury.routes.tsx`). Breadcrumb `Dashboard / Savings`, heading, subtitle,
  then loading / error / empty / loaded branches. The **empty state**
  (`savings-empty-state`) shows only when the user has *neither* set anything
  aside *nor* had any tax levied (`funded_balance === 0 && provisioned_total
  === 0`); a non-zero on either side is a real in-progress state and renders the
  zones. The loaded zones are wrapped in a `<Stagger>` (each zone a
  `<StaggerItem>`), so they enter with the two-beat — the card rises, then its
  count-up / chart draw-in fires — i.e. **motion is wired here at the source**,
  not bolted on by the landing that reuses these same components.

## Components

- `components/SavingsHeadline.tsx` — **Zone 1**. Hero number **"Set aside"**
  (`funded_balance`, emerald) beside the two framing stats **"Owed to your
  future self"** (`provisioned_total`) and **"Coverage"**
  (`funded / provisioned`, suppressed to `—` when nothing is provisioned). All
  three figures **count up** (`<CountUpNumber>`) as the card lands; the two
  framing stats bottom-align so they stay level when a label wraps in a narrow
  card.
- `components/SavingsComposition.tsx` — **Zone 2**. A **stacked horizontal
  bar** (not a donut) splitting **"Gained from self-tax"** (`recognized_revenue`,
  emerald — the savings the self-tax mechanism built) from **"Surplus you
  added"** (`deferred_balance`, amber — extra direct transfers on top). Both are
  **gains** in the account, framed as such (the *liability* — what's owed to the
  future self — lives on `SavingsHeadline`, never here). In the everyday case
  there is only the self-tax portion, so it reads as a single solid segment; the
  amber segment only appears once the user has added a surplus (a donut at a 98/2
  split looks broken). The donut primitive is reserved for the future treasury
  *expense* side. Reused by the landing's "cycle" showcase with fabricated data.
- `components/SavingsTrend.tsx` — **Zone 3**. Cumulative set-aside trend
  (running funded balance per ISO week, oldest → newest). Bars for short windows
  (≤5 buckets), a line otherwise — both from the shared chart primitives
  (`shared/components/charts/trendCharts.tsx`), themed **emerald** via the
  `*Class` overrides. **Controlled hover** renders the week's running balance as
  an HTML readout above the chart.

## API

- `api/queries.ts` — `useTreasurySummaryQuery(weeks = 12)` over
  `GET /api/v1/treasury/summary?weeks=…`. Returns `TreasurySummary`:
  `funded_balance`, `recognized_revenue` (→ "Gained from self-tax"),
  `deferred_balance` (→ "Surplus you added"), `provisioned_total` (→ "Owed to your
  future self"), `currency`, and `trend: TreasuryTrendPoint[]`
  (`period_end` / `cumulative_balance` / `delta`). The BE reconciles the journal
  on read, so the figures are always fresh.
- `api/keys.ts` — `treasuryKeys.summary(weeks)`; the window parameterises the
  cache so the page and a future hero on a different window don't collide.
- URL builder: `routes.treasury.summary()` in `shared/api/routes.ts`.

## State

None. The page is a pure read over react-query; money formatting comes from the
shared `useMoneyFormatter` (currency-aware, off user preferences).

## Tests

- `pages/SavingsPage.test.tsx` — empty state (zeroed summary), the populated
  three zones (headline number, coverage %, both composition legend amounts +
  the deferred segment), the single-segment collapse when `deferred_balance ===
  0`, and the error banner on a 500.
- MSW handler: `src/test/handlers/treasury.ts` returns a zeroed summary by
  default (so unrelated pages render the empty state for free); tests override
  with `server.use(...)` for the populated shapes.
