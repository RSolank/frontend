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

// POST /api/consumption-tax/bills/:id/pay — marks the bill paid. Backend
// transitions the bill row and creates the consumption-tax-paid txn.
export function payBillRequest(billId: number): Promise<unknown> {
  return apiFetch(routes.taxation.billPay(billId), {
    method: 'POST',
  });
}
