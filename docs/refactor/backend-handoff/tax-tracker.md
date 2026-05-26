# Backend handoff — Tax Tracker current-week endpoint

> Created during Frontend Batch 7 (2026-05-26). Drop a copy of this
> file next to `.scratch/task-backend-platform.md` so the backend
> team picks it up as part of the Phase 0.7 incremental-taxation
> work (`taxation_engine.recalc_for_txn(txn_id)` ledger redesign).
>
> Frontend can ship Batch 7 without this endpoint — the
> `CurrentWeekTracker` card renders a "pending" empty state on 404 /
> 501 and the rest of the Tax Tracker (bills list + generation + bill
> detail) still works. Once this endpoint ships the card lights up
> automatically; no frontend follow-up needed beyond removing the
> 404 swallow in `features/taxation/api/queries.ts:fetchTrackerCurrentWeek`.

---

## Endpoint

**`GET /api/consumption-tax/tracker/current-week`**

Authenticated. Returns the in-progress (current accruing) week's tax
state for the requesting user, derived from the live ledger.

### Response shape

```jsonc
{
  "period_start": "2026-03-01",   // YYYY-MM-DD, user-tz Sunday
  "period_end":   "2026-03-07",   // YYYY-MM-DD, user-tz Saturday
  "running_tax":      125.42,     // sum of tax accrued so far this week
  "running_penalty":   18.30,     // sum of penalty accrued so far this week
  "projected_tax":    287.50,     // backend's best projection to week end
  "projected_penalty": 42.00,     // (linear, EMA, ML — backend choice)
  "per_tag": [                     // top contributing tags this week
    {
      "tag_id":   33,
      "tag_name": "Dining",
      "txn_type": "discretionary",
      "tax_amount": 50.0,
      "penalty":    12.5
    },
    /* … */
  ],
  "is_estimate": false             // optional — when true, frontend
                                   //   surfaces a "Backend is
                                   //   returning approximate data"
                                   //   amber banner. Use during the
                                   //   ledger rollout window.
}
```

Frontend already types the shape — see
[`features/taxation/api/queries.ts`](../../../src/features/taxation/api/queries.ts)
(`TrackerCurrentWeekResponse` + `PerTagContribution`). The endpoint
just needs to match.

### Behavior

- **Week boundary** — Sun → Sat in the user's timezone (header
  `x-user-timezone` per the existing `UserPreferencesMiddleware`
  contract). The frontend's `weekRangeInTz` helper computes the same
  boundary; the response must agree.
- **`running_tax` / `running_penalty`** — sum of
  `consumption_tax_txns` rows whose underlying txn date falls inside
  the week, **including** rows from any still-ACCRUING bill (per
  Decision 21 — the bill is a real-time ledger now, no batch artifact).
  Exclude `is_adjustment=true` rows whose `adjustment_for_bill_id`
  points at a past BILLED-or-later bill (those reflect historical
  edits and shouldn't double-count this week).
- **`projected_*`** — backend chooses the projection model. Simplest
  start: linear extrapolation by day-of-week elapsed:
  `projected_tax = running_tax / fraction_of_week_elapsed`. Frontend
  has a `fractionOfWeekElapsed(date, tz)` helper that does the same
  computation client-side when `projected_*` is zero / missing.
- **`per_tag[]`** — at most 10 entries, sorted descending by
  `tax_amount + penalty`. Frontend slices to the top 5 for display.
- **`is_estimate`** — optional flag for the rollout window when the
  ledger is partially populated. Frontend renders an amber banner
  when true.

### Caching

Read-only. Frontend uses `staleTime: 60s` + `refetchInterval: 5min`
so a 30–60s server-side cache is fine. Invalidate (or just let the
client re-fetch) when:

- A new transaction lands for the user in this week's range.
- A categorization rule that affects this week's txns gets edited
  (frontend already invalidates `taxationKeys.all` on those events
  — backend doesn't need to do anything).

### Error semantics

- `200` with the shape above — happy path.
- `404` / `501` — frontend treats as "endpoint not implemented yet"
  and renders the pending empty state. Use during incremental
  rollout if the user's data is incomplete.
- Other 4xx / 5xx — normal apiClient error path; frontend would show
  a generic "Failed to load" alert.

---

## Why this is queued, not blocked

The Tax Tracker enhancement was scoped against the implementation_plan
Batch 7 entry:

> Tax Tracker enhancement (new surfaces added during the move):
>  - Current week running tax — live accrual against in-progress
>    week's transactions (not just past finalized bills). Pulls from
>    consumption_tax_txns + an as-yet-unbilled aggregator endpoint
>    (verify backend exposes this; if not, queue as a backend
>    follow-up and ship with finalized bills only for now).
>  - Per-category tax contribution / Forecast / Penalty breakdown.

Frontend chose the "ship finalized bills + scaffold the pending
surfaces" route per the 2026-05-26 user direction. This file captures
the contract so the backend team can implement against a single,
agreed shape without further coordination.

---

## Bill detail items — already-present fields (no backend change needed)

The frontend bill detail modal now renders an **Amount** column for
each per-txn item. Verified against
`backend/app/modules/taxation/taxation_services.py:get_bill` —
`Transaction.amount` and `Transaction.debit_credit` are already
selected and serialized into each item:

```python
.select(
    ConsumptionTaxTxn.txn_id,
    Transaction.txn_date.label("date"),
    Transaction.beneficiary,
    Transaction.amount,          # ← surfaced as `amount`
    Transaction.debit_credit,    # ← available if future UI wants the side
    ConsumptionTaxTxn.txn_type,
    ConsumptionTaxTxn.tax_amount,
    ConsumptionTaxTxn.penalty,
    ConsumptionTaxTxn.tag_id.label("penalty_tag_id"),
    Tag.tag_name.label("penalty_tag_name"),
)
```

So **no backend change is required for the Amount column**. The
legacy `ConsumptionTaxPage.jsx` simply didn't display it. Mentioning
here so the backend team can confirm + reject any incoming "frontend
needs amount" tickets.

## Taxation rule create — covered by existing PUT (no POST needed)

The frontend Add-rule flow (modal-first, lands `Frontend Batch 7
refinement 2`) calls `PUT /api/taxation-rules/:txn_type` for both
create and update. The current `taxation_routes.py:upsert_taxation_rule`
handler is already upsert:

```python
@rules_router.put("/{txn_type}")
async def upsert_taxation_rule(...):
    ...
    rule = await taxation_services.upsert_rule(...)
```

`upsert_rule` in `taxation_services.py` inserts when no row exists
and updates when one does. So **no POST endpoint is required**.
Adding one would be a parallel surface with identical semantics;
the frontend deliberately stays on PUT to keep the surface area tight.

If the backend later prefers POST-for-create / PUT-for-update for
strict REST hygiene, that's a one-day frontend swap (replace the
mutation call site) — but it's not blocking and not requested. The
PUT-upsert is the canonical path.

## Related backend work

This endpoint is a natural fit for Phase 0.7 of the backend platform
plan (incremental taxation engine). Once `consumption_tax_txns`
becomes a real-time ledger (per Decision 21), the running totals are
already in the ledger — the endpoint is a thin SELECT + group-by over
the in-progress week. Until then, an interim implementation that
sums uncommitted-bill rows is fine; the contract stays the same.

When ready:

1. Implement the endpoint in `app/modules/taxation/taxation_routes.py`
   (alongside the existing `list_bills` / `get_bill` / `pay_bill` handlers).
2. Add it to `frontend_handoff/web.md` so this entry can be marked
   resolved.
3. (Optional, frontend follow-up) Remove the 404 / 501 swallow in
   `fetchTrackerCurrentWeek` once the endpoint is reliably present —
   for now the swallow is doing useful "graceful degradation" work
   and shouldn't be ripped out until rollout is confirmed.
