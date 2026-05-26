import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';

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
  return apiFetch<TaxationRulesResponse>('/api/taxation-rules/');
}

export function useTaxationRulesQuery() {
  return useQuery({
    queryKey: taxationKeys.rulesList(),
    queryFn: fetchTaxationRules,
  });
}

// --- Consumption-tax bills --------------------------------------------------

// Bill list-shape (lightweight). Detail shape carries the full
// per-txn breakdown returned by GET /api/consumption-tax/bills/:id.
export type BillStatus = 'pending' | 'paid' | string;

export interface BillSummary {
  bill_id: number;
  period_start: string;
  period_end: string;
  status: BillStatus;
  amount: number;
}

export interface BillsListResponse {
  bills: BillSummary[];
}

export interface BillTotals {
  tax_total: number;
  penalty_total: number;
}

export interface BillItem {
  txn_id: number;
  date: string;
  beneficiary: string | null;
  txn_type: string;
  // Raw transaction amount + side. Backend's `get_bill` already
  // returns both; the legacy UI ignored them. Surfaced now so the
  // bill detail modal can show "you spent X, taxed Y".
  amount?: number | null;
  debit_credit?: 'debit' | 'credit' | string | null;
  tax_amount: number;
  penalty: number;
  penalty_tag_id?: number | null;
  penalty_tag_name?: string | null;
  tag_name?: string | null;
  tag_id?: number | null;
}

export interface BillDetail extends BillSummary {
  totals?: BillTotals;
  items?: BillItem[];
}

export function fetchBills(): Promise<BillsListResponse> {
  return apiFetch<BillsListResponse>('/api/consumption-tax/bills');
}

export function fetchBill(billId: number): Promise<BillDetail> {
  return apiFetch<BillDetail>(`/api/consumption-tax/bills/${billId}`);
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

// --- Tax Tracker — current-week running tax (scaffold) ----------------------

// Scaffold shape for the Tax Tracker enhancement. Backend will implement
// GET /api/consumption-tax/tracker/current-week (see
// `.scratch/task-handoff-fe-to-be.md §1` for the spec). Until then
// the query falls back to a client-side aggregation built from the
// transactions list — `useTrackerCurrentWeekQuery` swallows the 404 and
// returns an empty payload so the page renders the "Backend pending"
// empty state instead of an error.
export interface PerTagContribution {
  tag_id: number;
  tag_name: string;
  txn_type: string;
  tax_amount: number;
  penalty: number;
}

export interface TrackerCurrentWeekResponse {
  period_start: string; // YYYY-MM-DD (week start, Sun in user tz)
  period_end: string; // YYYY-MM-DD (week end, Sat in user tz)
  // Sum so far of accrued tax in the in-progress week.
  running_tax: number;
  // Sum of penalty accruals so far.
  running_penalty: number;
  // Linear projection to week end, based on day-of-week elapsed.
  projected_tax: number;
  projected_penalty: number;
  // Breakdown by tag (top contributors) for the in-progress week.
  per_tag: PerTagContribution[];
  // Optional flag set by the backend when the endpoint is feature-gated
  // off (pending real data). The UI uses this to surface a "Backend
  // pending — showing approximate data" hint.
  is_estimate?: boolean;
}

export async function fetchTrackerCurrentWeek(): Promise<
  TrackerCurrentWeekResponse | null
> {
  try {
    return await apiFetch<TrackerCurrentWeekResponse>(
      '/api/consumption-tax/tracker/current-week'
    );
  } catch (err) {
    // Endpoint not yet implemented (HTTP 404 / 501). The page treats
    // this as "no data" rather than an error so the rest of the Tax
    // Tracker still renders. See `.scratch/task-handoff-fe-to-be.md §1`.
    const e = err as { status?: number };
    if (e?.status === 404 || e?.status === 501) return null;
    throw err;
  }
}

export function useTrackerCurrentWeekQuery() {
  return useQuery({
    queryKey: taxationKeys.trackerCurrentWeek(),
    queryFn: fetchTrackerCurrentWeek,
    // Refresh every 5 min — the running tax accrues as new txns land.
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
