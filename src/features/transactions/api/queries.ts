import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';

import {
  transactionKeys,
  type TransactionListParams,
} from './keys';
import type {
  SingleTransactionResponse,
  TransactionListResponse,
} from './schemas';

function listQueryString(params: TransactionListParams): string {
  const sp = new URLSearchParams();
  sp.set('limit', String(params.limit));
  sp.set('offset', String(params.offset));
  if (params.debit_credit) sp.set('debit_credit', params.debit_credit);
  if (params.group_by) sp.set('group_by', params.group_by);
  if (params.sort_by) sp.set('sort_by', params.sort_by);
  if (params.order) sp.set('order', params.order);
  if (params.tag_id) sp.set('tag_id', String(params.tag_id));
  if (params.month) sp.set('month', params.month);
  if (params.beneficiary_id)
    sp.set('beneficiary_id', String(params.beneficiary_id));
  return sp.toString();
}

export function fetchTransactions(
  params: TransactionListParams
): Promise<TransactionListResponse> {
  return apiFetch<TransactionListResponse>(
    `/api/transactions?${listQueryString(params)}`
  );
}

export function fetchTransaction(
  id: number | string
): Promise<SingleTransactionResponse> {
  return apiFetch<SingleTransactionResponse>(`/api/transactions/${id}`);
}

export function useTransactionsQuery(params: TransactionListParams) {
  return useQuery({
    queryKey: transactionKeys.list(params),
    queryFn: () => fetchTransactions(params),
  });
}
