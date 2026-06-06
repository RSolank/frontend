import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { taxationKeys } from './keys';

// --- Taxation rules ---------------------------------------------------------

// Server-shape returned by GET /api/taxation-rules. `tax_rate` and
// `default_penalty_rate` are fractions (0.05 = 5%). `is_default` flags
// the system-seeded fallback row that the user hasn't overridden yet.
export interface TaxationRule {
  txn_type: string;
  tax_rate: number;
  default_penalty_rate: number;
  is_default?: boolean;
}

export interface TaxationRulesResponse {
  rules: TaxationRule[];
}

export function fetchTaxationRules(): Promise<TaxationRulesResponse> {
  return apiFetch<TaxationRulesResponse>(routes.taxation.rules());
}

export function useTaxationRulesQuery() {
  return useQuery({
    queryKey: taxationKeys.rulesList(),
    queryFn: fetchTaxationRules,
  });
}

// --- Consumption-tax bills --------------------------------------------------

// BE Phase 2.6 (`e7c05aa`, T-taxation) 5-state bill machine. The old
// `'pending' | 'paid'` 2-state shape is gone — every consumer must
// branch on the literal 5-state enum.
//
//   ACCRUING → BILLED → { PAID | OVERDUE } → EXPIRED
//
// `ACCRUING` is the in-progress, weekly-worker-mutated row; the user
// settles `BILLED` (or `OVERDUE`) bills. `EXPIRED` is the terminal
// state the worker writes when the unpaid-bill threshold is hit
// (`STALE_BILL_THRESHOLD`, default 4).
export type BillStatus = 'ACCRUING' | 'BILLED' | 'PAID' | 'OVERDUE' | 'EXPIRED';

export interface BillSummary {
  bill_id: number;
  user_id?: number;
  period_start: string;
  period_end: string;
  status: BillStatus;
  // `amount` is the bill total (tax + penalty). `amount_paid` is the
  // settled portion — partial payment is `amount_paid < amount`.
  amount: number;
  amount_paid: number;
  // Lifecycle timestamps. `billed_at` is set on ACCRUING→BILLED,
  // `paid_at` on transition to PAID. `due_date` is `billed_at + grace`.
  billed_at?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  last_modified?: string | null;
}

export interface BillsListResponse {
  bills: BillSummary[];
}

export interface BillTotals {
  tax_total: number;
  penalty_total: number;
}

// BE Phase 2.6 — `is_adjustment=true` rows are tax-system artifacts,
// not transactions of the user's. They land on the current ACCRUING
// bill when a past BILLED-or-later bill's source txn is edited
// (Decision 23); they carry a back-reference to the originating bill
// (`adjustment_for_bill_id`). The FE separates them visually from
// real items.
export interface BillItem {
  txn_id?: number | null;
  date?: string | null;
  beneficiary?: string | null;
  txn_type: string;
  // Raw transaction amount + side. Backend's `get_bill` already
  // returns both; the legacy UI ignored them. Surfaced now so the
  // bill detail modal can show "you spent X, taxed Y".
  amount?: number | null;
  debit_credit?: 'debit' | 'credit' | string | null;
  tax_amount: number;
  penalty: number;
  is_adjustment?: boolean;
  adjustment_for_bill_id?: number | null;
  penalty_tag_id?: number | null;
  penalty_tag_name?: string | null;
  tag_name?: string | null;
  tag_id?: number | null;
}

// BE Phase 2.6 — manual mark-paid + auto FIFO allocations both land
// as rows on this list, distinguishable by `source`.
export interface BillAllocation {
  payment_txn_id?: number | null;
  amount: number;
  source: 'manual' | 'auto' | string;
  allocated_at?: string | null;
}

export interface BillDetail extends BillSummary {
  totals?: BillTotals;
  items?: BillItem[];
  allocations?: BillAllocation[];
}

export function fetchBills(): Promise<BillsListResponse> {
  return apiFetch<BillsListResponse>(routes.taxation.bills());
}

export function fetchBill(billId: number): Promise<BillDetail> {
  return apiFetch<BillDetail>(routes.taxation.billById(billId));
}

export function useBillsQuery() {
  return useQuery({
    queryKey: taxationKeys.billsList(),
    queryFn: fetchBills,
  });
}

export function useBillQuery(billId: number | null) {
  return useQuery({
    queryKey: billId != null ? taxationKeys.billDetail(billId) : ['_disabled'],
    queryFn: () => fetchBill(billId as number),
    enabled: billId != null,
  });
}

// --- Tax Tracker — current-week running tax ---------------------------------

// Shape returned by `useTrackerCurrentWeekQuery`. Historically this
// was the wire payload for `GET /api/consumption-tax/tracker/current-week`,
// but that BE endpoint was never shipped — the FE now derives the
// shape from the ACCRUING bill (see the hook below).
// Period boundaries are ISO Mon → Sun in the user's timezone.
export interface PerTagContribution {
  tag_id: number;
  tag_name: string;
  txn_type: string;
  tax_amount: number;
  penalty: number;
}

export interface TrackerCurrentWeekResponse {
  period_start: string; // YYYY-MM-DD (week start, Mon in user tz)
  period_end: string; // YYYY-MM-DD (week end, Sun in user tz)
  // Sum so far of accrued tax in the in-progress week.
  running_tax: number;
  // Sum of penalty accruals so far.
  running_penalty: number;
  // Linear projection to week end, based on fraction of week elapsed.
  projected_tax: number;
  projected_penalty: number;
  // Breakdown by tag (top contributors, ≤10, sorted by
  // tax_amount + penalty desc) for the in-progress week.
  per_tag: PerTagContribution[];
  // Backend sets this during the T-taxation rollout window while
  // the ledger backfills historic weeks; cleared once a fresh full
  // week has accrued. UI renders an amber banner when true.
  is_estimate: boolean;
}

// **FE-side derivation (2026-06-06):** the previously-spec'd
// `GET /api/v1/consumption-tax/tracker/current-week` was never
// shipped by BE despite the coord doc marking Phase 2.6 as LANDED;
// every call 404'd, callers showed a permanent "Loading…" state.
// The taxation engine already maintains the in-progress week as the
// ACCRUING bill, so the FE composes `useBillsQuery` (to find the
// ACCRUING row) + `useBillQuery` (its items/totals) and reshapes
// them into the tracker view. Three callers — `CurrentWeekTracker`,
// `TaxTrackerCard`, `WeekSummaryWidget` — keep their existing
// `{data, isLoading, isError}` destructure; `data === null` means
// "no in-progress bill yet" (treat as zero state).
export function useTrackerCurrentWeekQuery(): {
  data: TrackerCurrentWeekResponse | null;
  isLoading: boolean;
  isError: boolean;
} {
  const billsQuery = useBillsQuery();
  const accruing =
    billsQuery.data?.bills.find((b) => b.status === 'ACCRUING') ?? null;
  const billDetailQuery = useBillQuery(accruing?.bill_id ?? null);

  const data: TrackerCurrentWeekResponse | null =
    accruing && billDetailQuery.data
      ? deriveTrackerFromBill(billDetailQuery.data)
      : null;

  return {
    data,
    isLoading:
      billsQuery.isLoading || (accruing !== null && billDetailQuery.isLoading),
    isError: billsQuery.isError || billDetailQuery.isError,
  };
}

function deriveTrackerFromBill(bill: BillDetail): TrackerCurrentWeekResponse {
  // Adjustment items (`is_adjustment=true`) are tax-system artifacts
  // from edits to past BILLED-or-later bills (Decision 23) — exclude
  // them so a late-arriving correction doesn't pollute the
  // in-progress week's running totals + per-tag attribution.
  const items = (bill.items ?? []).filter((i) => !i.is_adjustment);
  const running_tax = bill.totals?.tax_total ?? 0;
  const running_penalty = bill.totals?.penalty_total ?? 0;

  // Aggregate per-tag. Penalty rows carry their own `penalty_tag_id`
  // distinct from the originating spend's `tag_id`, so a breached-
  // budget penalty surfaces under the penalty tag (e.g. "Penalty —
  // Discretionary") rather than the over-spent category.
  const byTag = new Map<number, PerTagContribution>();
  for (const item of items) {
    if (item.tax_amount) {
      foldInto(byTag, {
        tag_id: item.tag_id ?? 0,
        tag_name: item.tag_name ?? 'Uncategorized',
        txn_type: item.txn_type,
        tax_amount: item.tax_amount,
        penalty: 0,
      });
    }
    if (item.penalty) {
      foldInto(byTag, {
        tag_id: item.penalty_tag_id ?? item.tag_id ?? 0,
        tag_name: item.penalty_tag_name ?? item.tag_name ?? 'Uncategorized',
        txn_type: item.txn_type,
        tax_amount: 0,
        penalty: item.penalty,
      });
    }
  }
  const per_tag = Array.from(byTag.values())
    .sort((a, b) => b.tax_amount + b.penalty - (a.tax_amount + a.penalty))
    .slice(0, 10);

  return {
    period_start: bill.period_start,
    period_end: bill.period_end,
    running_tax,
    running_penalty,
    // Projection columns are derived presentationally (linear by
    // elapsed-week fraction) inside CurrentWeekTracker — leave them
    // zero here so callers that need the raw running totals aren't
    // confused by inflated estimates.
    projected_tax: 0,
    projected_penalty: 0,
    per_tag,
    is_estimate: false,
  };
}

function foldInto(
  byTag: Map<number, PerTagContribution>,
  delta: PerTagContribution
) {
  const existing = byTag.get(delta.tag_id);
  if (existing) {
    existing.tax_amount += delta.tax_amount;
    existing.penalty += delta.penalty;
    return;
  }
  byTag.set(delta.tag_id, { ...delta });
}
