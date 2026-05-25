// React-query keys for the transactions feature. List queries vary by
// filter / sort / pagination params so the cache key embeds them;
// mutations invalidate the broad `transactionKeys.all` namespace plus
// `tagKeys.all` (transactions surface tag chips, so a tag rename / delete
// downstream still bubbles up here).
export interface TransactionListParams {
  limit: number;
  offset: number;
  debit_credit?: 'debit' | 'credit';
  group_by?: 'merchant';
  sort_by?: string;
  order?: 'asc' | 'desc';
  tag_id?: string | number;
  month?: string;
  beneficiary_id?: string | number;
}

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (params: TransactionListParams) =>
    [...transactionKeys.lists(), params] as const,
  detail: (id: number | string) =>
    [...transactionKeys.all, 'detail', String(id)] as const,
} as const;

export const statementUploadKeys = {
  all: ['statement-upload'] as const,
} as const;
