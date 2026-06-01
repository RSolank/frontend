// BE Phase 1.5 (`f369ce2`) — recurring inference engine DTOs.
//
// The backend runs a worker (APScheduler ladder) that scans the user's
// transactions, infers candidate patterns, and forecasts upcoming
// occurrences into the `recurring_bills` table. The user is
// source-of-truth: any PATCH transfers `created_by` to the user and
// freezes the worker out of further mutations on that row.
//
// `status` semantics (3-state machine):
//   - `candidate` — worker-detected, never confirmed. FE labels
//     "Detected".
//   - `review`    — anomaly streak (missed or amount-drifted bills)
//     hit the worker's threshold; the engine wants user
//     acknowledgement. FE labels "Needs attention".
//   - `locked`    — user-confirmed or user-authored. Worker forecasts
//     + reconciles but never mutates fields. FE labels "Confirmed".
//
// `active` + status together gate forecasting (only
// `active=true AND status in {locked, review}` is materialized into
// upcoming bills).

export type RecurringCadence = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const RECURRING_CADENCES: RecurringCadence[] = [
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
];

export type RecurringStatus = 'candidate' | 'review' | 'locked';

export type RecurringPatternType = 'FIXED_AMOUNT' | 'FIXED_CADENCE';

export type RecurringDirection = 'debit' | 'credit';

export interface RecurringTemplate {
  uid: number;
  beneficiary_id: number;
  debit_credit: RecurringDirection;
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

// Bill rows from `/upcoming` (forecast, pending) and `/history`
// (settled, possibly reconciled to a real txn). `matched_txn_id` is
// non-null once the engine matches an inbound txn to the forecast.
export type RecurringBillStatus = 'pending' | 'confirmed' | 'expired';

export interface RecurringBill {
  uid: number;
  template_id: number;
  beneficiary_id: number;
  expected_amount: number;
  debit_credit: RecurringDirection;
  due_date: string;
  status: RecurringBillStatus;
  matched_txn_id: number | null;
}

// Create body — every required column the user must supply when
// declaring a template by hand. Mirrors `RecurringTemplateCreate`
// on the BE; the worker-detected path uses the same shape internally
// but the FE never POSTs candidate rows (worker writes them).
export interface RecurringTemplateCreatePayload {
  beneficiary_id: number;
  debit_credit: RecurringDirection;
  cadence: RecurringCadence;
  expected_amount: number;
  next_due_date: string;
  pattern_type?: RecurringPatternType;
  cadence_interval?: number;
  amount_tolerance?: number;
  day_of_month?: number | null;
  day_of_week?: number | null;
  week_of_month?: number | null;
}

// PATCH body — every column is optional. Touching ANY field transfers
// ownership; `status: 'locked'` is the Confirm action, `active: false`
// is the soft-dismiss (also reachable via DELETE — keep both paths
// available so the UI can re-activate without retyping the row).
export interface RecurringTemplateUpdatePayload {
  expected_amount?: number;
  amount_tolerance?: number;
  cadence?: RecurringCadence;
  cadence_interval?: number;
  pattern_type?: RecurringPatternType;
  day_of_month?: number | null;
  day_of_week?: number | null;
  week_of_month?: number | null;
  next_due_date?: string;
  status?: RecurringStatus;
  active?: boolean;
}

// FE form shape — pre-payload, all strings so it composes with
// react-hook-form / `<input>` directly. The submit step coerces +
// validates + drops the not-applicable calendar anchors for the
// chosen cadence.
export interface RecurringTemplateFormInput {
  beneficiary_id: number | null;
  debit_credit: RecurringDirection;
  cadence: RecurringCadence;
  expected_amount: string;
  next_due_date: string;
  cadence_interval: string;
  amount_tolerance: string;
  day_of_month: string;
  day_of_week: string;
  week_of_month: string;
}

export function emptyRecurringForm(
  defaultDate: string
): RecurringTemplateFormInput {
  return {
    beneficiary_id: null,
    debit_credit: 'debit',
    cadence: 'MONTHLY',
    expected_amount: '',
    next_due_date: defaultDate,
    cadence_interval: '1',
    amount_tolerance: '0.15',
    day_of_month: '',
    day_of_week: '',
    week_of_month: '',
  };
}

export function templateToForm(
  template: RecurringTemplate
): RecurringTemplateFormInput {
  return {
    beneficiary_id: template.beneficiary_id,
    debit_credit: template.debit_credit,
    cadence: template.cadence,
    expected_amount: String(template.expected_amount),
    next_due_date: template.next_due_date,
    cadence_interval: String(template.cadence_interval),
    amount_tolerance: String(template.amount_tolerance),
    day_of_month:
      template.day_of_month === null ? '' : String(template.day_of_month),
    day_of_week:
      template.day_of_week === null ? '' : String(template.day_of_week),
    week_of_month:
      template.week_of_month === null ? '' : String(template.week_of_month),
  };
}

function intInRange(raw: string, lo: number, hi: number): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

function floatInRange(raw: string, lo: number, hi: number): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

// Calendar anchors — only the ones meaningful for the chosen cadence
// land on the wire. The BE re-validates, but trimming upfront keeps
// the request body honest.
function calendarAnchors(
  form: RecurringTemplateFormInput
): Partial<RecurringTemplateCreatePayload> {
  if (form.cadence === 'WEEKLY') {
    const dow = intInRange(form.day_of_week, 0, 6);
    return dow !== null ? { day_of_week: dow } : {};
  }
  // MONTHLY + YEARLY both anchor on day_of_month (YEARLY's
  // anchor_date carries the month server-side).
  const dom = intInRange(form.day_of_month, 1, 31);
  return dom !== null ? { day_of_month: dom } : {};
}

// Coerce + drop-not-applicable. Returns the create body for POST —
// returns null when the form is missing a required field so the
// caller can keep the Save button disabled without re-doing the
// validation.
export function formToCreatePayload(
  form: RecurringTemplateFormInput
): RecurringTemplateCreatePayload | null {
  if (form.beneficiary_id == null) return null;
  const amount = Number(form.expected_amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!form.next_due_date) return null;

  const interval = intInRange(form.cadence_interval, 1, Number.MAX_SAFE_INTEGER);
  const tol = floatInRange(form.amount_tolerance, 0, 1);

  return {
    beneficiary_id: form.beneficiary_id,
    debit_credit: form.debit_credit,
    cadence: form.cadence,
    expected_amount: amount,
    next_due_date: form.next_due_date,
    ...(interval !== null ? { cadence_interval: interval } : {}),
    ...(tol !== null ? { amount_tolerance: tol } : {}),
    ...calendarAnchors(form),
  };
}
