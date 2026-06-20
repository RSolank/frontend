import { z } from 'zod';

// The Add / Edit transaction forms share most of the same shape; Edit
// of a `statement`-sourced row only allows `notes` + `tag_ids` so the
// schema is permissive (no `.required()` on amount / type / date) and
// the page enforces source-specific required-ness at submit time.
export const transactionFormSchema = z.object({
  amount: z.string().default(''),
  debit_credit: z.enum(['debit', 'credit']).default('debit'),
  beneficiary_id: z.union([z.string(), z.number()]).default(''),
  txn_date: z.string().default(''),
  notes: z.string().default(''),
  tag_ids: z.array(z.number()).default([]),
});
export type TransactionFormInput = z.infer<typeof transactionFormSchema>;

// Server-shape payload for POST/PATCH /api/transactions. The backend
// accepts `beneficiary_id: null` to clear the link and `beneficiary_name`
// to spawn a new beneficiary in one call (Add flow).
//
// `bank_account_id` (Batch 13f, BE handoff item): nullable link to a
// user's bank account; the DB column exists on `transactions` and is
// consumed by the statement-upload auto-attribution path, but the BE
// transaction POST/PATCH routes do NOT yet expose the field in their
// Pydantic schemas. The FE sends it speculatively — FastAPI ignores
// unknown body fields, so it's a graceful no-op until BE adds it.
// `TransactionDTO` likewise omits it for now; once BE returns it
// EditTransaction can pre-select the saved value.
export interface TransactionCreatePayload {
  amount: number;
  debit_credit: 'debit' | 'credit';
  beneficiary_id: number | null;
  beneficiary_name?: string | null;
  bank_account_id?: number | null;
  txn_date: string;
  notes: string | null;
  tag_ids: number[];
}

// PATCH allows partial updates; statement-sourced rows only send
// notes + tag_ids; manual rows send the full shape.
export type TransactionUpdatePayload =
  | { notes: string | null; tag_ids: number[] }
  | TransactionCreatePayload;

export interface TransactionDTO {
  txn_id: number;
  txn_date: string;
  beneficiary_id?: number | null;
  beneficiary_name?: string | null;
  amount: number;
  debit_credit: 'debit' | 'credit';
  source: 'manual' | 'statement';
  notes?: string | null;
  tag_ids: number[];
  // The recurring template this txn settled (null if not a recurring instance).
  // Stamped BE-side at reconcile; drives the recurring chip.
  recurring_template_id?: number | null;
}

// BE returns one of two response shapes off the same path:
//   - flat:    {transactions, returned_count, limit, offset}            ← `TransactionListResponse`
//   - grouped: {groups, period_type, period_start?, returned_count, ...} ← `GroupedTransactionsResponse`
// (see backend/app/modules/transactions/transaction_schemas.py). We
// model both as one optional-fields interface for ergonomic consumer
// code; consumers branch on `groups` vs `transactions`.
//
// BE 2026-06-06 update (`9c00ecd`): the grouped read now defaults to
// **all-time aggregation** when no `month`/`period`/`date` is given —
// previously it scoped to the current month, which made the merchant
// view show empty for backdated imports despite the trackers being
// populated. The new envelope therefore carries:
//   - `period_type: 'weekly' | 'monthly' | 'all'` — `'all'` is the
//     no-window case (sum of every monthly bucket).
//   - `period_start: string | null` — bucket start date for
//     `weekly`/`monthly`; `null` for the all-time window.
export interface TransactionListResponse {
  transactions?: TransactionDTO[];
  groups?: MerchantGroup[];
  period_type?: 'weekly' | 'monthly' | 'all' | string;
  period_start?: string | null;
  returned_count: number;
}

// BE Phase 1.7 (T-aggregates-engine, `3252ca4`) renamed the
// per-merchant aggregate fields: `frequency → total_count`,
// `total_amount → net_expense` (= `total_debit − total_credit`,
// expense-positive — refunds net it down). `?group_by=tag` rows
// also carry `tag_id` / `tag_name` / `tag_type` so consumers can
// split budgets-typed tags from the general tracker view.
export interface MerchantGroup {
  beneficiary_id?: number | null;
  beneficiary_name?: string | null;
  tag_id?: number | null;
  tag_name?: string | null;
  tag_type?: string | null;
  total_count: number;
  net_expense: number;
}

export interface SingleTransactionResponse {
  transaction: TransactionDTO | null;
}

// Statement-upload responses moved to
// [`statement_upload/api/schemas.ts`](../statement_upload/api/schemas.ts)
// alongside the BE Phase 2.2 async-job DTOs. The legacy
// `UploadResult` / `ProblematicTxn` shapes (4-step sync pipeline)
// are retired with the BE endpoints.
