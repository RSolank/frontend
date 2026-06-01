import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { TaxationRule } from './queries';
import type { TaxationRuleFormInput, BillGenerateInput } from './schemas';

// PUT /api/taxation-rules/:txn_type — upsert. Returns the saved rule.
export function updateTaxationRuleRequest(
  txnType: string,
  payload: TaxationRuleFormInput
): Promise<{ rule: TaxationRule }> {
  return apiFetch<{ rule: TaxationRule }>(
    routes.taxation.ruleByType(txnType),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

// POST /api/consumption-tax/bills/generate — returns the IDs of any
// freshly-generated bills for the requested period range.
export function generateBillsRequest(
  payload: BillGenerateInput
): Promise<{ bill_ids: number[] }> {
  return apiFetch<{ bill_ids: number[] }>(
    routes.taxation.billGenerate(),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

// BE Phase 2.6 — `pay_bill` removed; replaced by mark-paid / mark-unpaid
// (Decision 25, user-attestation semantics — the engine never writes
// a transaction, it just reconciles existing txn data).
//
// `payment_txn_id`: optional, links a real payment txn to the bill.
// `amount`: optional override; defaults to the txn amount (linked) or
// the remaining balance (override).
export interface MarkPaidRequest {
  payment_txn_id?: number | null;
  amount?: number | null;
}

export interface MarkPaidResponse {
  status: string;
  bill_id: number;
  amount_paid: number;
}

export interface MarkUnpaidResponse {
  status: string;
  bill_id: number;
}

export function markBillPaidRequest(
  billId: number,
  body: MarkPaidRequest = {}
): Promise<MarkPaidResponse> {
  return apiFetch<MarkPaidResponse>(routes.taxation.billMarkPaid(billId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function markBillUnpaidRequest(
  billId: number
): Promise<MarkUnpaidResponse> {
  return apiFetch<MarkUnpaidResponse>(routes.taxation.billMarkUnpaid(billId), {
    method: 'POST',
  });
}
