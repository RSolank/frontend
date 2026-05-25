import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createCategorizationRule,
  type CreateCategorizationRulePayload,
} from '../../beneficiaries/api/mutations';
import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';
import {
  fetchTagConstants,
  fetchTags,
  type TagConstants,
  type TagNode,
} from '../../tags/api/queries';
import { tagKeys } from '../../tags/api/keys';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { todayInUserTz } from '../../../shared/utils/dateUtils';
import { transactionKeys } from '../api/keys';
import { createTransactionRequest } from '../api/mutations';
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

export function AddTransactionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timezone = usePreferencesStore((s) => s.timezone);

  const [tags, setTags] = useState<FlatTag[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [constants, setConstants] = useState<TagConstants | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [debitCredit, setDebitCredit] = useState<'debit' | 'credit'>('debit');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState<number | string>('');
  const [txnDate, setTxnDate] = useState(() => todayInUserTz(timezone));
  const [notes, setNotes] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchTags().then((d) => flattenTags(d.tags)),
      fetchBeneficiaries(),
      fetchTagConstants(),
    ])
      .then(([tagList, bList, consts]) => {
        if (cancelled) return;
        setTags(tagList);
        setBeneficiaries(bList);
        setConstants(consts);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Failed to load metadata');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAddTag(tagId: number) {
    setTagIds((prev) => {
      if (prev.includes(tagId)) return prev;
      const MISC_ID = constants?.MISCELLANEOUS_TAG_ID;
      if (MISC_ID && tagId !== MISC_ID) {
        return [...prev.filter((x) => x !== MISC_ID), tagId];
      }
      // Adding misc with nothing else selected is allowed; otherwise no-op.
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
    setSubmitting(true);
    setError(null);

    try {
      let ruleIdToLink: number | null = null;
      if (tagIds.length > 0 && beneficiaryId) {
        if (
          window.confirm(
            'Would you like to create a categorization rule for this beneficiary?'
          )
        ) {
          const payload: CreateCategorizationRulePayload = {
            name: `Rule for ${beneficiaryName}`,
            beneficiary_id: beneficiaryId,
            tag_ids: tagIds,
          };
          const created = await createCategorizationRule(payload);
          ruleIdToLink = created.rule.uid;
        }
      }

      await createTransactionRequest(
        {
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
        },
        ruleIdToLink
      );

      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
      navigate('/transactions');
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto my-6 max-w-xl px-4 sm:my-10">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h1 className="mb-6 text-xl font-bold text-slate-900 dark:text-slate-100">
          Add Transaction
        </h1>
        {loadError && <div className="form-error mb-3">{loadError}</div>}
        {error && <div className="form-error mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <BeneficiarySearch
            value={beneficiaryName}
            beneficiaryId={beneficiaryId}
            beneficiaries={beneficiaries}
            onChange={(name, id) => {
              setBeneficiaryName(name);
              setBeneficiaryId(id);
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
                required
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
              required
              className="form-input"
            />
          </div>

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
              {submitting ? 'Creating...' : 'Create Transaction'}
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
