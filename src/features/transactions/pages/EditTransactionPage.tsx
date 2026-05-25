import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  createCategorizationRule,
  updateCategorizationRuleTags,
} from '../../beneficiaries/api/mutations';
import {
  fetchBeneficiaries,
  fetchCategorizationRules,
  type Beneficiary,
  type CategorizationRule,
} from '../../beneficiaries/api/queries';
import {
  fetchTagConstants,
  fetchTags,
  type TagConstants,
  type TagNode,
} from '../../tags/api/queries';
import { tagKeys } from '../../tags/api/keys';
import { formatInputDate } from '../../../shared/utils/dateUtils';
import { transactionKeys } from '../api/keys';
import { updateTransactionRequest } from '../api/mutations';
import { fetchTransaction } from '../api/queries';
import type {
  TransactionCreatePayload,
  TransactionDTO,
  TransactionUpdatePayload,
} from '../api/schemas';
import { BeneficiarySearch } from '../components/BeneficiarySearch';
import { TagSelector } from '../components/TagSelector';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

function flattenTags(nodes: TagNode[] | undefined, out: FlatTag[] = []): FlatTag[] {
  for (const n of nodes ?? []) {
    out.push({ tag_id: n.tag_id, tag_name: n.tag_name });
    flattenTags(n.children, out);
  }
  return out;
}

function sortedKey(ids: number[]): string {
  return JSON.stringify([...ids].sort((a, b) => a - b));
}

export function EditTransactionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [txn, setTxn] = useState<TransactionDTO | null>(null);
  const [tags, setTags] = useState<FlatTag[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [constants, setConstants] = useState<TagConstants | null>(null);

  const [amount, setAmount] = useState('');
  const [debitCredit, setDebitCredit] = useState<'debit' | 'credit'>('debit');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState<number | string>('');
  const [txnDate, setTxnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      fetchTransaction(id).then((d) => d.transaction),
      fetchTags().then((d) => flattenTags(d.tags)),
      fetchBeneficiaries(),
      fetchTagConstants(),
    ])
      .then(([t, tagList, bList, consts]) => {
        if (cancelled) return;
        setConstants(consts);
        setTags(tagList);
        setBeneficiaries(bList);
        if (!t) {
          setNotFound(true);
          setLoaded(true);
          return;
        }
        setTxn(t);
        setBeneficiaryName(t.beneficiary_name || '');
        setBeneficiaryId(t.beneficiary_id || '');
        setAmount(String(t.amount ?? ''));
        setDebitCredit(t.debit_credit);
        setTxnDate(formatInputDate(t.txn_date));
        setNotes(t.notes || '');
        setTagIds(t.tag_ids || []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load data');
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleAddTag(tagId: number) {
    setTagIds((prev) => {
      if (prev.includes(tagId)) return prev;
      const MISC_ID = constants?.MISCELLANEOUS_TAG_ID;
      if (MISC_ID && tagId !== MISC_ID) {
        return [...prev.filter((x) => x !== MISC_ID), tagId];
      }
      if (MISC_ID && tagId === MISC_ID) {
        return prev.length === 0 ? [MISC_ID] : prev;
      }
      return [...prev, tagId];
    });
  }

  function handleRemoveTag(tagId: number) {
    setTagIds((prev) => {
      const next = prev.filter((x) => x !== tagId);
      const MISC_ID = constants?.MISCELLANEOUS_TAG_ID;
      if (next.length === 0 && MISC_ID && tagId !== MISC_ID) {
        return [MISC_ID];
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id || !txn) return;
    setSubmitting(true);
    setError(null);

    try {
      const tagsChanged =
        sortedKey(tagIds) !== sortedKey(txn.tag_ids ?? []);

      let ruleIdToLink: number | null = null;
      if (tagsChanged && beneficiaryId) {
        const createRule = window.confirm(
          'You updated the tags. Would you like to create/update a categorization rule for this beneficiary?'
        );
        if (createRule) {
          const { rules } = await fetchCategorizationRules();
          const existingRule = rules.find(
            (r: CategorizationRule) =>
              r.beneficiary_id === Number(beneficiaryId)
          );

          if (existingRule) {
            if (
              window.confirm(
                `A rule for this beneficiary already exists. Update it with these tags?`
              )
            ) {
              await updateCategorizationRuleTags(existingRule.uid, tagIds);
              ruleIdToLink = existingRule.uid;
            }
          } else {
            const created = await createCategorizationRule({
              name: `Rule for ${beneficiaryName}`,
              beneficiary_id: beneficiaryId,
              tag_ids: tagIds,
            });
            ruleIdToLink = created.rule.uid;
          }
        }
      }

      const payload: TransactionUpdatePayload =
        txn.source === 'statement'
          ? {
              notes: notes || null,
              tag_ids: tagIds,
            }
          : ({
              amount: parseFloat(amount),
              debit_credit: debitCredit,
              beneficiary_id:
                typeof beneficiaryId === 'number'
                  ? beneficiaryId
                  : beneficiaryId
                    ? Number(beneficiaryId)
                    : null,
              beneficiary_name: beneficiaryName || null,
              txn_date: txnDate,
              notes: notes || null,
              tag_ids: tagIds,
            } satisfies TransactionCreatePayload);

      await updateTransactionRequest(id, payload, ruleIdToLink);
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
      navigate('/transactions');
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto my-10 max-w-xl px-4">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto my-10 max-w-xl px-4">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
          <p className="form-error">Transaction not found</p>
        </div>
      </div>
    );
  }

  const isStatement = txn?.source === 'statement';

  return (
    <div className="mx-auto my-6 max-w-xl px-4 sm:my-10">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h1 className="mb-6 text-xl font-bold text-slate-900 dark:text-slate-100">
          Edit Transaction
        </h1>
        {error && <div className="form-error mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isStatement && (
            <>
              <BeneficiarySearch
                value={beneficiaryName}
                beneficiaryId={beneficiaryId}
                beneficiaries={beneficiaries}
                onChange={(name, bid) => {
                  setBeneficiaryName(name);
                  setBeneficiaryId(bid);
                }}
                required
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="amount" className="form-label">
                    Amount
                  </label>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label htmlFor="debit_credit" className="form-label">
                    Type
                  </label>
                  <select
                    id="debit_credit"
                    name="debit_credit"
                    value={debitCredit}
                    onChange={(e) =>
                      setDebitCredit(e.target.value as 'debit' | 'credit')
                    }
                    className="form-input"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="txn_date" className="form-label">
                  Date
                </label>
                <input
                  id="txn_date"
                  name="txn_date"
                  type="date"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                  className="form-input"
                />
              </div>
            </>
          )}

          <TagSelector
            tags={tags}
            selectedTagIds={tagIds}
            miscellaneousTagId={constants?.MISCELLANEOUS_TAG_ID as number | undefined}
            totalTagId={constants?.TOTAL_TAG_ID as number | undefined}
            onAdd={handleAddTag}
            onRemove={handleRemoveTag}
          />

          <div>
            <label htmlFor="notes" className="form-label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="form-input resize-y"
            />
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
