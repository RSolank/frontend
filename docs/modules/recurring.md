# Recurring feature

> Inference-engine surface for recurring transactions. The backend
> worker (BE Phase 1.5, `f369ce2`) scans the user's transaction
> history, detects recurring patterns, and forecasts upcoming bills
> into a `recurring_bills` table; this feature lets the user
> Confirm / Edit / Dismiss detected templates, author new ones by
> hand, and glance at the 7-day (dashboard) / 30-day (page) forecast.
> Lives at [`src/features/recurring/`](../../src/features/recurring/).

## Purpose

- Surface BE-detected recurring patterns so the user can confirm
  the ones that should keep forecasting, edit anything that shifted,
  or dismiss patterns that no longer apply.
- Expose user-authored CRUD as a secondary path (`+ Add manually`
  in the page header) for templates the engine hasn't detected yet.
- Render the forecast — pending bill rows from
  `GET /api/v1/recurring/upcoming?days=N` — on the dashboard (`days=7`)
  and on the `/recurring` Upcoming tab (`days=30`).

The page is an **inference-engine surface**, NOT a user-template
materializer (see backend `[[recurring-engine-design]]` memory). The
backend NEVER writes transactions — when a real txn lands that
matches a forecast row, the engine reconciles it (`matched_txn_id`)
but the txn itself came from the manual-entry / statement-upload
path. FE should keep the framing: "Here's what we detected — confirm
or modify."

## Pages

| Path         | Component                 | Notes                                                                                        |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------- |
| `/recurring` | `pages/RecurringPage.tsx` | Lazy-loaded. Two tabs (Templates / Upcoming-30d), inference-first bucketing under Templates. |

Routes are exported from
[`recurring.routes.tsx`](../../src/features/recurring/recurring.routes.tsx)
and composed into the root router by `src/app/routes.tsx` (wrapped
by `protectedRoutes()` like every authenticated surface).

## Status semantics (BE 3-state machine)

| BE value    | UI label            | Meaning                                                                                                            | Confirm action available?     |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `candidate` | **Detected**        | Worker spotted the pattern; user has never confirmed.                                                              | ✅ (PATCH `status: 'locked'`) |
| `review`    | **Needs attention** | Anomaly streak (missed or amount-drifted bills) crossed the worker's threshold; engine wants user acknowledgement. | ✅                            |
| `locked`    | **Confirmed**       | User-confirmed or user-authored. Worker forecasts + reconciles but never mutates fields.                           | —                             |

`active` + status together gate forecasting: only
`active=true AND status in {locked, review}` produces bills. The
"Inactive" bucket on the page renders rows with `active=false` —
soft-dismissed by DELETE, recoverable via PATCH `active: true`.

## Components

| File                                  | Purpose                                                                                                                                                                                                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/RecurringPage.tsx`             | Two-tab management surface. Templates tab buckets by status (Needs attention → Detected → Confirmed → Inactive); Upcoming tab renders the 30-day forecast list. "+ Add manually" in the header opens `RecurringFormDialog`.                                                      |
| `components/RecurringTemplateRow.tsx` | One row per template — direction icon + name + status chip + Inactive chip + amount / cadence / next-due / occurrence count + Confirm / Edit / Dismiss actions. Confirm is hidden on `locked` rows.                                                                              |
| `components/RecurringStatusChip.tsx`  | Maps BE statuses to user-facing labels with tone-appropriate Tailwind classes (slate / amber / emerald). Title-attribute tooltip exposes the inference framing for power users.                                                                                                  |
| `components/RecurringFormDialog.tsx`  | Add + edit dialog. View-model hook (`useRecurringForm`) owns dirtiness + save flow. SearchableSelect for beneficiary; cadence-aware day-of-week / day-of-month anchor field. Trash button in the header per the Remove-in-edit convention. `confirmOnDirty` guards stray closes. |
| `components/CadenceAnchorField.tsx`   | Cadence-driven calendar-anchor input: WEEKLY → day-of-week dropdown (ISO 0=Mon … 6=Sun); MONTHLY/YEARLY → day-of-month number input.                                                                                                                                             |
| `components/UpcomingBillsList.tsx`    | Shared list view for the page's Upcoming tab. Pulls `useRecurringUpcomingQuery(days)`, joins to `useBeneficiariesQuery()` for names, renders one row per bill with debit/credit sign + amount + due date.                                                                        |

## API + cache

| Hook                              | BE endpoint                             | Stale | Notes                                                                                                          |
| --------------------------------- | --------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `useRecurringTemplatesQuery()`    | `GET /api/v1/recurring/templates`       | 60s   | Returns every template owned by the user (active + inactive, all statuses).                                    |
| `useRecurringUpcomingQuery(days)` | `GET /api/v1/recurring/upcoming?days=N` | 60s   | BE clamps `days ≤ 90`. Pending bill rows in the window; `matched_txn_id` null until reconciliation.            |
| `useRecurringHistoryQuery(days)`  | `GET /api/v1/recurring/history?days=N`  | 60s   | BE clamps `days ≤ 30`. Settled bills with their reconciled txn id. Exported but not yet consumed in a surface. |

Mutations are bare request functions (no `useMutation` wrappers in
this batch); the page invalidates `recurringKeys.all` after every
write so templates + upcoming + history refresh together.

| Function                                     | BE endpoint                                | Notes                                                                                            |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `createRecurringTemplateRequest(payload)`    | `POST /api/v1/recurring/templates`         | User-authored template (born `locked`).                                                          |
| `updateRecurringTemplateRequest(uid, patch)` | `PATCH /api/v1/recurring/templates/{uid}`  | Touching ANY field transfers `created_by` to the user; `status: 'locked'` is the Confirm action. |
| `deleteRecurringTemplateRequest(uid)`        | `DELETE /api/v1/recurring/templates/{uid}` | Soft-deactivate. Bills cascade.                                                                  |

## Wire DTOs

```ts
// features/recurring/api/schemas.ts
type RecurringCadence = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type RecurringStatus = 'candidate' | 'review' | 'locked';
type RecurringPatternType = 'FIXED_AMOUNT' | 'FIXED_CADENCE';

interface RecurringTemplate {
  uid: number;
  beneficiary_id: number;
  debit_credit: 'debit' | 'credit';
  pattern_type: RecurringPatternType;
  expected_amount: number;
  amount_tolerance: number;
  cadence: RecurringCadence;
  cadence_interval: number;
  day_of_month: number | null;
  day_of_week: number | null;
  week_of_month: number | null;
  anchor_date: string;
  next_due_date: string;
  status: RecurringStatus;
  active: boolean;
  occurrence_count: number;
  last_seen_date: string | null;
  last_confirmed_date: string | null;
  created_at: string;
}

interface RecurringBill {
  uid: number;
  template_id: number;
  beneficiary_id: number;
  expected_amount: number;
  debit_credit: 'debit' | 'credit';
  due_date: string;
  status: 'pending' | 'confirmed' | 'expired';
  matched_txn_id: number | null;
}
```

## Out of scope (deferred)

- **Transactions-list recurring chip** — rendering a small "↻" indicator
  on materialized rows linking back to the template editor. Requires
  BE to expose `recurring_template_id` (or equivalent) on
  `TransactionResponse`, or a heavy client-side join via
  `/recurring/history.matched_txn_id`. Scope-cut at Batch 11
  kick-off; revisit when BE surfaces the link directly.
- **Statement-upload reconciliation** — matching imported txns to
  forecast bills. Internal BE concern, deferred follow-up.
- **Notifications** + **per-user-tz** worker — gated by the BE
  notifications track.

## Tests

| File                                      | Coverage                                                                                                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/schemas.test.ts`                     | `templateToForm` round-trip; `formToCreatePayload` cadence-anchor drop-not-applicable (WEEKLY → drops day_of_month; MONTHLY → drops day_of_week); missing-beneficiary / non-positive-amount nulls; tolerance / interval omission when invalid. |
| `pages/RecurringPage.test.tsx`            | Empty state; bucket ordering (Needs attention → Detected → Confirmed); Confirm button hidden on locked rows; tab toggle swaps to upcoming-empty.                                                                                               |
| `components/RecurringStatusChip.test.tsx` | Label mapping per status (candidate → Detected, review → Needs attention, locked → Confirmed).                                                                                                                                                 |
