import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DateField } from '../../../shared/components/DateField';
import { getDefaultTxnKind } from '../../../shared/state/defaultTxnKind.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { todayInUserTz } from '../../../shared/utils/dateUtils';
import { BankAccountField } from '../../bankAccounts/components/BankAccountField';
import {
  createCategorizationRule,
  type CreateCategorizationRulePayload,
} from '../../beneficiaries/api/mutations';
import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';
import { BeneficiaryFormDialog } from '../../beneficiaries/components/BeneficiaryFormDialog';
import { tagKeys } from '../../tags/api/keys';
import type { CreatedTag } from '../../tags/api/mutations';
import {
  fetchTagConstants,
  fetchTags,
  type TagConstants,
  type TagNode,
} from '../../tags/api/queries';
import { TagFormDialog } from '../../tags/components/TagFormDialog';
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

interface AddTransactionPageProps {
  // When provided, the form calls `onClose` after success / cancel
  // instead of navigating to /transactions — used when mounted inside
  // the list-page modal. Standalone route entry leaves this undefined
  // and falls back to navigate-based dismissal.
  onClose?: () => void;
  // Optional — invoked after a successful create with the new txn id
  // so the parent list can flash the row (Row highlight on save).
  onSaved?: (txnId: number) => void;
  // Hide the redundant page-level chrome (outer card + h1) when
  // mounted inside a <Modal /> that already supplies them.
  embedded?: boolean;
  // Pre-fill the date field instead of defaulting to "today". Used by
  // the calendar view's "Add transaction for this day" CTA so the
  // selected day flows straight into the form. Expected `YYYY-MM-DD`
  // in the user's tz (matching `<input type="date">`'s value shape).
  defaultDate?: string;
}

// Normalise the beneficiary id for the payload — number stays, a non-empty
// string coerces, empty becomes null. if/else (not a nested ternary) so it
// stays off sonarjs/no-nested-conditional. (Mirrors the same helper in
// EditTransactionPage; kept local per the no-cross-feature-internals rule.)
function resolveBeneficiaryId(beneficiaryId: number | string): number | null {
  if (typeof beneficiaryId === 'number') return beneficiaryId;
  if (beneficiaryId) return Number(beneficiaryId);
  return null;
}

// View-model: owns all the add-transaction form state, the metadata load
// effect, and every handler (beneficiary/tag create + select, tag add/
// remove with the misc-tag rules, submit with the optional rule-create
// prompt). Keeps the page component a thin render under the max-lines gate.
function useAddTransactionForm({
  onClose,
  onSaved,
  defaultDate,
}: AddTransactionPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timezone = usePreferencesStore((s) => s.timezone);
  const dismiss = () => (onClose ? onClose() : navigate('/transactions'));

  const [tags, setTags] = useState<FlatTag[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [constants, setConstants] = useState<TagConstants | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  // Read once on mount via getState() — editing the preference later
  // shouldn't flip an already-open form. See defaultTxnKind.store.ts.
  const [debitCredit, setDebitCredit] = useState<'debit' | 'credit'>(() =>
    getDefaultTxnKind()
  );
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState<number | string>('');
  const [txnDate, setTxnDate] = useState(
    () => defaultDate || todayInUserTz(timezone)
  );
  const [notes, setNotes] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  // Batch 13f: optional bank-account picker. Sent in the POST
  // payload; BE transaction routes don't read it yet (handoff
  // item), so it's a graceful no-op until BE wires it in.
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline create modals for beneficiary + tag (Batch 6.5 follow-up).
  // Open them from the picker dropdowns rather than navigating away.
  const [createBeneficiaryOpen, setCreateBeneficiaryOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);

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

  async function handleBeneficiaryCreated(b: Beneficiary) {
    // Refresh the local list so the dropdown shows the new row, then
    // auto-select it for the in-flight transaction.
    try {
      const next = await fetchBeneficiaries();
      setBeneficiaries(next);
    } catch (err) {
      console.warn('Failed to refresh beneficiaries after create', err);
    }
    setBeneficiaryName(b.name);
    setBeneficiaryId(b.uid);
  }

  async function handleTagCreated(created?: CreatedTag) {
    // Refresh tags so the new id is available in the picker, then
    // auto-add it to the in-flight selection.
    try {
      const next = await fetchTags();
      setTags(flattenTags(next.tags));
    } catch (err) {
      console.warn('Failed to refresh tags after create', err);
    }
    if (created?.tag_id != null) handleAddTag(created.tag_id);
  }

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

      const res = await createTransactionRequest(
        {
          amount: parseFloat(amount),
          debit_credit: debitCredit,
          beneficiary_id: resolveBeneficiaryId(beneficiaryId),
          beneficiary_name: beneficiaryName || null,
          bank_account_id: bankAccountId,
          txn_date: txnDate,
          notes: notes || null,
          tag_ids: tagIds,
        },
        ruleIdToLink
      );

      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
      if (res?.transaction?.txn_id != null) onSaved?.(res.transaction.txn_id);
      dismiss();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return {
    dismiss,
    tags,
    beneficiaries,
    constants,
    loadError,
    amount,
    setAmount,
    debitCredit,
    setDebitCredit,
    beneficiaryName,
    setBeneficiaryName,
    beneficiaryId,
    setBeneficiaryId,
    txnDate,
    setTxnDate,
    notes,
    setNotes,
    bankAccountId,
    setBankAccountId,
    tagIds,
    submitting,
    error,
    createBeneficiaryOpen,
    setCreateBeneficiaryOpen,
    createTagOpen,
    setCreateTagOpen,
    handleBeneficiaryCreated,
    handleTagCreated,
    handleAddTag,
    handleRemoveTag,
    handleSubmit,
  };
}

export function AddTransactionPage({
  onClose,
  onSaved,
  embedded = false,
  defaultDate,
}: AddTransactionPageProps = {}) {
  const {
    dismiss,
    tags,
    beneficiaries,
    constants,
    loadError,
    amount,
    setAmount,
    debitCredit,
    setDebitCredit,
    beneficiaryName,
    setBeneficiaryName,
    beneficiaryId,
    setBeneficiaryId,
    txnDate,
    setTxnDate,
    notes,
    setNotes,
    bankAccountId,
    setBankAccountId,
    tagIds,
    submitting,
    error,
    createBeneficiaryOpen,
    setCreateBeneficiaryOpen,
    createTagOpen,
    setCreateTagOpen,
    handleBeneficiaryCreated,
    handleTagCreated,
    handleAddTag,
    handleRemoveTag,
    handleSubmit,
  } = useAddTransactionForm({ onClose, onSaved, defaultDate });

  const body = (
    <>
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
            onRequestAddBeneficiary={() => setCreateBeneficiaryOpen(true)}
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
            <DateField
              id="txn_date"
              name="txn_date"
              value={txnDate}
              onChange={setTxnDate}
              required
            />
          </div>

          <TagSelector
            tags={tags}
            selectedTagIds={tagIds}
            miscellaneousTagId={constants?.MISCELLANEOUS_TAG_ID as number | undefined}
            totalTagId={constants?.TOTAL_TAG_ID as number | undefined}
            onAdd={handleAddTag}
            onRemove={handleRemoveTag}
            onRequestAddTag={() => setCreateTagOpen(true)}
          />

          <BankAccountField
            id="bank-account-picker-add"
            label="Bank account"
            value={bankAccountId}
            onChange={setBankAccountId}
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
              onClick={dismiss}
              className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>

        <BeneficiaryFormDialog
          open={createBeneficiaryOpen}
          onClose={() => setCreateBeneficiaryOpen(false)}
          onSaved={handleBeneficiaryCreated}
          initialName={beneficiaryName}
        />
        <TagFormDialog
          open={createTagOpen}
          onClose={() => setCreateTagOpen(false)}
          onSaved={handleTagCreated}
          flatTags={tags}
        />
      </>
  );

  if (embedded) return body;

  return (
    <div className="mx-auto my-6 max-w-xl px-4 sm:my-10">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h1 className="mb-6 text-xl font-bold text-slate-900 dark:text-slate-100">
          Add Transaction
        </h1>
        {body}
      </div>
    </div>
  );
}
