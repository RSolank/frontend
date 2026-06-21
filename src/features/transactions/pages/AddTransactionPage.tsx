import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { DateField } from '../../../shared/components/DateField';
import { RuleReviewModal } from '../../../shared/components/RuleReviewModal';
import { CATEGORIZATION_RULES_PATH } from '../../../shared/navigation/rulePrefill';
import { getDefaultTxnKind } from '../../../shared/state/defaultTxnKind.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { todayInUserTz } from '../../../shared/utils/dateUtils';
import { BankAccountField } from '../../bankAccounts/components/BankAccountField';
import {
  fetchBeneficiaries,
  fetchCategorizationRules,
  type Beneficiary,
  type CategorizationRule,
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
import { findRuleForBeneficiary, sameTagSet } from '../api/ruleFlow';
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

function flattenTags(
  nodes: TagNode[] | undefined,
  out: FlatTag[] = []
): FlatTag[] {
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
// effect, and every handler (beneficiary/tag create + select, tag add/remove
// with the misc-tag rules, the categorization-rule flow on submit —
// auto-populate, create-prompt / diverge-review, and navigation to the
// categorization rules page to actually create/edit the rule).
// eslint-disable-next-line max-lines-per-function -- a cohesive form view-model: the state, load effect and handlers are tightly coupled; splitting would scatter them. Add/Edit deliberately keep this logic local + duplicated (see resolveBeneficiaryId note) rather than sharing a hook.
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
  // The user's categorization rules — drives tag auto-populate on beneficiary
  // select and the create / diverge decision at submit time.
  const [rules, setRules] = useState<CategorizationRule[]>([]);
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
  // Batch 13f: optional bank-account picker. Sent in the POST payload; BE
  // transaction routes don't read it yet (handoff item), so it's a graceful
  // no-op until BE wires it in.
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline create modals for beneficiary + tag (Batch 6.5 follow-up).
  const [createBeneficiaryOpen, setCreateBeneficiaryOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);

  // "Create a categorization rule?" prompt (no rule exists for this
  // beneficiary). ref-stored resolver keeps the submit flow a straight await.
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const createResolveRef = useRef<((ok: boolean) => void) | null>(null);
  function promptCreate(): Promise<boolean> {
    return new Promise((resolve) => {
      createResolveRef.current = resolve;
      setConfirmCreateOpen(true);
    });
  }
  function decideCreate(ok: boolean) {
    setConfirmCreateOpen(false);
    const r = createResolveRef.current;
    createResolveRef.current = null;
    r?.(ok);
  }

  // The diverge-review modal: when the chosen tags differ from the
  // beneficiary's existing rule, show the rule (read-only) + the diff, and let
  // the user override for this txn or head to the rule editor.
  const [reviewRule, setReviewRule] = useState<CategorizationRule | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchTags().then((d) => flattenTags(d.tags)),
      fetchBeneficiaries(),
      fetchTagConstants(),
      fetchCategorizationRules().then((d) => d.rules),
    ])
      .then(([tagList, bList, consts, ruleList]) => {
        if (cancelled) return;
        setTags(tagList);
        setBeneficiaries(bList);
        setConstants(consts);
        setRules(ruleList);
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

  // Tags are plain add/remove. The Miscellaneous fallback is *not* managed
  // here (categorization-v2): an empty tag set is submitted as-is and the
  // backend files the txn under the direction-correct Misc placeholder. The
  // TagSelector surfaces a passive hint of where it will land.
  function handleAddTag(tagId: number) {
    setTagIds((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]));
  }

  function handleRemoveTag(tagId: number) {
    setTagIds((prev) => prev.filter((x) => x !== tagId));
  }

  // Beneficiary select: auto-populate the tags from that beneficiary's rule
  // (overwriting any prior picks — "this beneficiary categorizes this way").
  // No rule → leave the current tags untouched.
  function handleBeneficiaryChange(name: string, id: number | string) {
    setBeneficiaryName(name);
    setBeneficiaryId(id);
    const rule = findRuleForBeneficiary(rules, id);
    if (rule) setTagIds([...rule.tag_ids]);
  }

  // Resolve tag ids → {id, name} for the review modal's diff.
  function tagObjects(ids: number[]) {
    return ids.map((id) => {
      const t = tags.find((x) => x.tag_id === id);
      return { tag_id: id, tag_name: t?.tag_name ?? `Tag ${id}` };
    });
  }

  // Build the payload from current form state and create the transaction.
  // Returns the new txn id on success (so the caller decides dismiss vs.
  // navigate-to-rule-editor), or null on failure. `ruleIdToLink` stamps the
  // tag rows' provenance.
  async function saveTxn(
    ruleIdToLink: number | null
  ): Promise<{ txnId: number | null } | null> {
    setSubmitting(true);
    setError(null);
    try {
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
      const txnId = res?.transaction?.txn_id ?? null;
      if (txnId != null) onSaved?.(txnId);
      return { txnId };
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to create');
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  // Navigate to the categorization rules page to create/edit the rule there
  // (keeps the transactions↔categorization boundary: a router redirect, not an
  // import; no nested modal). See shared/navigation/rulePrefill.
  function goToCreateRule(originatingTxnId: number | null) {
    navigate(CATEGORIZATION_RULES_PATH, {
      state: {
        rulePrefill: {
          mode: 'create',
          beneficiaryId: Number(beneficiaryId),
          beneficiaryName,
          tagIds,
          originatingTxnId: originatingTxnId ?? undefined,
        },
      },
    });
  }
  function goToEditRule(ruleId: number) {
    navigate(CATEGORIZATION_RULES_PATH, {
      state: {
        rulePrefill: {
          mode: 'edit',
          beneficiaryId: Number(beneficiaryId),
          beneficiaryName,
          tagIds,
          ruleId,
        },
      },
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Nothing to crystallise (no beneficiary or no tags) → create directly.
    if (!beneficiaryId || tagIds.length === 0) {
      if (await saveTxn(null)) dismiss();
      return;
    }

    const existingRule = findRuleForBeneficiary(rules, beneficiaryId);

    // No rule yet → offer to create one. On "yes" we save the txn first, then
    // head to the rules page to author the rule (pre-filled). On "skip" the
    // tags apply to this txn only.
    if (!existingRule) {
      const create = await promptCreate();
      const saved = await saveTxn(null);
      if (!saved) return;
      if (create) goToCreateRule(saved.txnId);
      else dismiss();
      return;
    }

    // Rule exists and the tags still match → save linked, no prompt.
    if (sameTagSet(tagIds, existingRule.tag_ids)) {
      if (await saveTxn(existingRule.uid)) dismiss();
      return;
    }

    // Tags diverge → open the read-only review (existing rule + diff).
    setReviewRule(existingRule);
  }

  // Review: keep the new tags on this transaction only — rule untouched.
  async function handleReviewOverride() {
    setReviewRule(null);
    if (await saveTxn(null)) dismiss();
  }

  // Review: proceed to update the rule. Save the txn linked to the existing
  // rule, then navigate to the rule editor pre-filled with the new tags.
  async function handleReviewUpdate() {
    const rule = reviewRule;
    setReviewRule(null);
    if (!rule) return;
    const saved = await saveTxn(rule.uid);
    if (!saved) return;
    goToEditRule(rule.uid);
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
    beneficiaryId,
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
    handleBeneficiaryChange,
    handleBeneficiaryCreated,
    handleTagCreated,
    handleAddTag,
    handleRemoveTag,
    handleSubmit,
    confirmCreateOpen,
    decideCreate,
    reviewRule,
    tagObjects,
    handleReviewOverride,
    handleReviewUpdate,
    closeReview: () => setReviewRule(null),
  };
}

// eslint-disable-next-line max-lines-per-function -- thin render shell: destructures the view-model then lays out the form + inline dialogs (beneficiary/tag create, the create prompt, the rule-review modal). The logic lives in the hook above; the residual length is flat JSX.
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
    beneficiaryId,
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
    handleBeneficiaryChange,
    handleBeneficiaryCreated,
    handleTagCreated,
    handleAddTag,
    handleRemoveTag,
    handleSubmit,
    confirmCreateOpen,
    decideCreate,
    reviewRule,
    tagObjects,
    handleReviewOverride,
    handleReviewUpdate,
    closeReview,
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
          onChange={handleBeneficiaryChange}
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
          miscellaneousTagId={
            constants?.MISCELLANEOUS_TAG_ID as number | undefined
          }
          miscCreditTagId={constants?.MISC_CREDIT_TAG_ID as number | undefined}
          totalTagId={constants?.TOTAL_TAG_ID as number | undefined}
          debitCredit={debitCredit}
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
          <button type="submit" disabled={submitting} className="btn-primary">
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
      <ConfirmDialog
        open={confirmCreateOpen}
        title="Create categorization rule?"
        message="Save this beneficiary + tag pairing as a categorization rule so future transactions auto-tag the same way. You'll review it on the rules page."
        confirmLabel="Create rule"
        cancelLabel="Skip"
        intent="primary"
        onConfirm={() => decideCreate(true)}
        onClose={() => decideCreate(false)}
      />
      <RuleReviewModal
        open={reviewRule != null}
        beneficiaryName={beneficiaryName}
        currentTags={reviewRule ? tagObjects(reviewRule.tag_ids) : []}
        newTags={tagObjects(tagIds)}
        onOverrideForTransaction={handleReviewOverride}
        onUpdateRule={handleReviewUpdate}
        onClose={closeReview}
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
