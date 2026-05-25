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
export interface TransactionCreatePayload {
  amount: number;
  debit_credit: 'debit' | 'credit';
  beneficiary_id: number | null;
  beneficiary_name?: string | null;
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
  beneficiary?: string | null;
  amount: number;
  debit_credit: 'debit' | 'credit';
  source: 'manual' | 'statement';
  notes?: string | null;
  tag_ids: number[];
}

export interface TransactionListResponse {
  transactions?: TransactionDTO[];
  groups?: MerchantGroup[];
  returned_count: number;
}

export interface MerchantGroup {
  beneficiary_id: number;
  beneficiary_name: string;
  frequency: number;
  total_amount: number;
}

export interface SingleTransactionResponse {
  transaction: TransactionDTO | null;
}

// Statement-upload pipeline responses (POST upload, POST map, POST categorize).
export interface ProblematicTxn {
  txn_id: number;
  beneficiary?: string | null;
  txn_date: string;
  debit_credit: 'debit' | 'credit';
  amount: number;
  tag_ids?: number[];
}

export interface UploadResult {
  upload_id: number;
  inserted_count: number;
  categorized_count: number;
  problematic_count: number;
  problematic?: ProblematicTxn[];
  requires_confirmation?: boolean;
}
