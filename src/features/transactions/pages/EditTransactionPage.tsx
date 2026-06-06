import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { DateField } from '../../../shared/components/DateField';
import { LockedFieldBanner } from '../../../shared/components/LockedFieldBanner';
import { formatInputDate } from '../../../shared/utils/dateUtils';
import { BankAccountField } from '../../bankAccounts/components/BankAccountField';
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

function sortedKey(ids: number[]): string {
  return JSON.stringify([...ids].sort((a, b) => a - b));
}

// Normalise the beneficiary id for the payload — number stays, a non-empty
// string coerces, empty becomes null. if/else (not a nested ternary) so it
// stays off sonarjs/no-nested-conditional.
function resolveBeneficiaryId(beneficiaryId: number | string): number | null {
  if (typeof beneficiaryId === 'number') return beneficiaryId;
  if (beneficiaryId) return Number(beneficiaryId);
  return null;
}

interface PayloadFields {
  amount: string;
  debitCredit: 'debit' | 'credit';
  beneficiaryId: number | string;
  beneficiaryName: string;
  txnDate: string;
  notes: string;
  // Batch 13f: optional bank-account link (manual rows only).
  // The BE doesn't yet read this field on PATCH — graceful no-op
  // until the BE handoff lands (see TransactionCreatePayload
  // schemas.ts comment).
  bankAccountId: number | null;
  tagIds: number[];
}

// Statement-sourced txns are bank-owned: only notes + tags are editable, so
// the payload carries just those. Manual txns send the full editable set.
// Pulled out of handleSubmit to keep that function under the gates.
function buildTransactionPayload(
  txn: TransactionDTO,
  fields: PayloadFields
): TransactionUpdatePayload {
  if (txn.source === 'statement') {
    return { notes: fields.notes || null, tag_ids: fields.tagIds };
  }
  return {
    amount: parseFloat(fields.amount),
    debit_credit: fields.debitCredit,
    beneficiary_id: resolveBeneficiaryId(fields.beneficiaryId),
    beneficiary_name: fields.beneficiaryName || null,
    bank_account_id: fields.bankAccountId,
    txn_date: fields.txnDate,
    notes: fields.notes || null,
    tag_ids: fields.tagIds,
  } satisfies TransactionCreatePayload;
}

interface RuleResolutionArgs {
  tagsChanged: boolean;
  beneficiaryId: number | string;
  beneficiaryName: string;
  tagIds: number[];
}

// Discriminator for the two distinct confirm steps in
// `resolveRuleToLink`. The page supplies a `confirm` async whose UX
// is a ConfirmDialog (Batch 15 — replaces the legacy window.confirm
// pair). Kept as a parameter so this helper stays a pure async
// flow free of UI state.
type RulePromptKind = 'create-or-update' | 'update-existing';

// The "tags changed → offer to create/update a categorization rule" flow.
// Returns the rule uid to link to the txn, or null if the user declines at
// any prompt / there's nothing to link.
async function resolveRuleToLink(
  args: RuleResolutionArgs,
  confirm: (kind: RulePromptKind) => Promise<boolean>
): Promise<number | null> {
  const { tagsChanged, beneficiaryId, beneficiaryName, tagIds } = args;
  if (!tagsChanged || !beneficiaryId) return null;
  if (!(await confirm('create-or-update'))) return null;

  const { rules } = await fetchCategorizationRules();
  const existingRule = rules.find(
    (r: CategorizationRule) => r.beneficiary_id === Number(beneficiaryId)
  );

  if (existingRule) {
    if (!(await confirm('update-existing'))) return null;
    await updateCategorizationRuleTags(existingRule.uid, tagIds);
    return existingRule.uid;
  }

  const created = await createCategorizationRule({
    name: `Rule for ${beneficiaryName}`,
    beneficiary_id: beneficiaryId,
    tag_ids: tagIds,
  });
  return created.rule.uid;
}

interface EditTransactionPageProps {
  // Override the URL :id when mounted from a modal on the list page.
  idOverride?: string;
  // Replace the navigate-back behavior when mounted inside a modal.
  onClose?: () => void;
  // Optional — invoked after a successful save with the edited txn id
  // so the parent list can flash the row (Row highlight on save).
  onSaved?: (txnId: number) => void;
  // Skip the outer card + h1 — caller modal owns the chrome.
  embedded?: boolean;
}

// eslint-disable-next-line max-lines-per-function -- the render is extracted to <EditTransactionForm> and the submit logic to module-level helpers; the residual is a flat field-load + handler shell. Splitting state/effect into a hook would add indirection without reducing real complexity (cx is already ~6 here).
export function EditTransactionPage({
  idOverride,
  onClose,
  onSaved,
  embedded = false,
}: EditTransactionPageProps = {}) {
  const params = useParams();
  const id = idOverride ?? params.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dismiss = () => (onClose ? onClose() : navigate('/transactions'));

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
  // Batch 13f: optional bank-account picker. Pre-load is gated on
  // the BE returning `bank_account_id` on `TransactionResponse`
  // (handoff item); until then, the picker loads as "No account"
  // and the field helper text spells out the gap so users know to
  // re-pick when they care.
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // Locked-field banner state. Surfaces on click of a readOnly field;
  // cleared automatically on the first successful edit. See the
  // LockedFieldBanner component for the auto-dismiss contract.
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  // Discard-changes confirm modal — opens when the Cancel button is
  // clicked while the form is dirty. The Modal's X / backdrop click
  // already routes through `confirmOnDirty`; this dialog matches that
  // flow for the explicit Cancel button.
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  // Mid-submit "create / update categorization rule?" prompt. Two
  // distinct ConfirmDialog steps (create-or-update → update-existing
  // if a rule already exists) driven by a ref-stored resolver so
  // `resolveRuleToLink` keeps its straight-line await flow.
  const [rulePromptKind, setRulePromptKind] = useState<RulePromptKind | null>(
    null
  );
  const ruleResolveRef = useRef<((ok: boolean) => void) | null>(null);
  function promptRule(kind: RulePromptKind): Promise<boolean> {
    return new Promise((resolve) => {
      ruleResolveRef.current = resolve;
      setRulePromptKind(kind);
    });
  }
  function decideRule(ok: boolean) {
    setRulePromptKind(null);
    const r = ruleResolveRef.current;
    ruleResolveRef.current = null;
    r?.(ok);
  }

  // Snapshot of the form fields at load time. Used for the Cancel
  // (revert to loaded values) flow + the isDirty diff.
  const initialSnapshotRef = useRef<{
    amount: string;
    debitCredit: 'debit' | 'credit';
    beneficiaryName: string;
    beneficiaryId: number | string;
    txnDate: string;
    notes: string;
    bankAccountId: number | null;
    tagIds: number[];
  } | null>(null);

  // Inline create modals for beneficiary + tag (Batch 6.5 follow-up).
  const [createBeneficiaryOpen, setCreateBeneficiaryOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);

  async function handleBeneficiaryCreated(b: Beneficiary) {
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
    try {
      const next = await fetchTags();
      setTags(flattenTags(next.tags));
    } catch (err) {
      console.warn('Failed to refresh tags after create', err);
    }
    if (created?.tag_id != null) handleAddTag(created.tag_id);
  }

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
        const loadedAmount = String(t.amount ?? '');
        const loadedDate = formatInputDate(t.txn_date);
        const loadedNotes = t.notes || '';
        const loadedBenName = t.beneficiary_name || '';
        const loadedBenId = t.beneficiary_id || '';
        const loadedTagIds = t.tag_ids || [];
        setBeneficiaryName(loadedBenName);
        setBeneficiaryId(loadedBenId);
        setAmount(loadedAmount);
        setDebitCredit(t.debit_credit);
        setTxnDate(loadedDate);
        setNotes(loadedNotes);
        setTagIds(loadedTagIds);
        initialSnapshotRef.current = {
          amount: loadedAmount,
          debitCredit: t.debit_credit,
          beneficiaryName: loadedBenName,
          beneficiaryId: loadedBenId,
          txnDate: loadedDate,
          notes: loadedNotes,
          // Batch 13f: BE doesn't return `bank_account_id` on
          // TransactionResponse yet (handoff). Snapshot is null;
          // any picker change registers as dirty.
          bankAccountId: null,
          tagIds: [...loadedTagIds],
        };
        setLockedReason(null);
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
      const tagsChanged = sortedKey(tagIds) !== sortedKey(txn.tag_ids ?? []);
      const ruleIdToLink = await resolveRuleToLink(
        {
          tagsChanged,
          beneficiaryId,
          beneficiaryName,
          tagIds,
        },
        promptRule
      );

      const payload = buildTransactionPayload(txn, {
        amount,
        debitCredit,
        beneficiaryId,
        beneficiaryName,
        txnDate,
        notes,
        bankAccountId,
        tagIds,
      });

      await updateTransactionRequest(id, payload, ruleIdToLink);
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
      const numericId = Number(id);
      if (Number.isFinite(numericId)) onSaved?.(numericId);
      // Row-highlight on the parent list communicates success; close
      // the modal cleanly.
      dismiss();
    } catch (err) {
      const apiErr = err as ApiErrorShape;
      setError(apiErr.detail || apiErr.error || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  const isStatement = txn?.source === 'statement';
  const STATEMENT_LOCK_REASON =
    'This transaction was imported from a bank statement — beneficiary, amount, type and date come from the upload and stay locked. You can still edit Tags and Notes.';

  const isDirty = useMemo(() => {
    const snap = initialSnapshotRef.current;
    if (!snap) return false;
    if (amount !== snap.amount) return true;
    if (debitCredit !== snap.debitCredit) return true;
    if (beneficiaryName !== snap.beneficiaryName) return true;
    if (beneficiaryId !== snap.beneficiaryId) return true;
    if (txnDate !== snap.txnDate) return true;
    if (notes !== snap.notes) return true;
    if (bankAccountId !== snap.bankAccountId) return true;
    if (sortedKey(tagIds) !== sortedKey(snap.tagIds)) return true;
    return false;
  }, [
    amount,
    debitCredit,
    beneficiaryName,
    beneficiaryId,
    txnDate,
    notes,
    bankAccountId,
    tagIds,
  ]);

  function clearLockedBannerOnEdit() {
    if (lockedReason) setLockedReason(null);
  }

  function handleCloseRequest() {
    if (!isDirty) {
      dismiss();
      return;
    }
    setConfirmDiscardOpen(true);
  }

  const onLockedFieldClick = isStatement
    ? () => setLockedReason(STATEMENT_LOCK_REASON)
    : undefined;

  function wrap(content: React.ReactNode) {
    if (embedded) return content;
    return (
      <div className="mx-auto my-6 max-w-xl px-4 sm:my-10">
        <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
          <h1 className="mb-6 text-xl font-bold text-slate-900 dark:text-slate-100">
            Edit Transaction
          </h1>
          {content}
        </div>
      </div>
    );
  }

  if (!loaded) {
    return wrap(
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
    );
  }

  if (notFound) {
    return wrap(<p className="form-error">Transaction not found</p>);
  }

  const dismissLabel = isDirty ? 'Cancel' : 'Close';
  const lockedInputClass = isStatement
    ? 'cursor-not-allowed bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
    : '';

  return wrap(
    <>
      <EditTransactionForm
        error={error}
        lockedReason={lockedReason}
        isStatement={isStatement}
        lockedInputClass={lockedInputClass}
        onLockedFieldClick={onLockedFieldClick}
        beneficiaryName={beneficiaryName}
        beneficiaryId={beneficiaryId}
        beneficiaries={beneficiaries}
        amount={amount}
        debitCredit={debitCredit}
        txnDate={txnDate}
        tags={tags}
        tagIds={tagIds}
        miscellaneousTagId={
          constants?.MISCELLANEOUS_TAG_ID as number | undefined
        }
        totalTagId={constants?.TOTAL_TAG_ID as number | undefined}
        notes={notes}
        bankAccountId={bankAccountId}
        submitting={submitting}
        isDirty={isDirty}
        dismissLabel={dismissLabel}
        onSubmit={handleSubmit}
        onBeneficiaryChange={(name, bid) => {
          clearLockedBannerOnEdit();
          setBeneficiaryName(name);
          setBeneficiaryId(bid);
        }}
        onRequestAddBeneficiary={() => setCreateBeneficiaryOpen(true)}
        onAmountChange={(value) => {
          clearLockedBannerOnEdit();
          setAmount(value);
        }}
        onDebitCreditChange={(value) => {
          clearLockedBannerOnEdit();
          setDebitCredit(value);
        }}
        onTxnDateChange={(value) => {
          clearLockedBannerOnEdit();
          setTxnDate(value);
        }}
        onAddTag={(tid) => {
          clearLockedBannerOnEdit();
          handleAddTag(tid);
        }}
        onRemoveTag={(tid) => {
          clearLockedBannerOnEdit();
          handleRemoveTag(tid);
        }}
        onRequestAddTag={() => setCreateTagOpen(true)}
        onNotesChange={(value) => {
          clearLockedBannerOnEdit();
          setNotes(value);
        }}
        onBankAccountChange={(value) => {
          clearLockedBannerOnEdit();
          setBankAccountId(value);
        }}
        onCloseRequest={handleCloseRequest}
      />

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
        open={confirmDiscardOpen}
        title="Discard changes?"
        message="You have unsaved changes. Discard them and close?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        intent="danger"
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          dismiss();
        }}
        onClose={() => setConfirmDiscardOpen(false)}
      />
      <ConfirmDialog
        open={rulePromptKind === 'create-or-update'}
        title="Update categorization rule?"
        message="You changed the tags. Save this beneficiary + tag pairing as a categorization rule so future transactions auto-tag the same way."
        confirmLabel="Yes, update rule"
        cancelLabel="Skip"
        intent="primary"
        onConfirm={() => decideRule(true)}
        onClose={() => decideRule(false)}
      />
      <ConfirmDialog
        open={rulePromptKind === 'update-existing'}
        title="Overwrite existing rule?"
        message="A categorization rule for this beneficiary already exists. Replace its tags with the new selection?"
        confirmLabel="Overwrite"
        cancelLabel="Cancel"
        intent="primary"
        onConfirm={() => decideRule(true)}
        onClose={() => decideRule(false)}
      />
    </>
  );
}

interface EditTransactionFormProps {
  error: string | null;
  lockedReason: string | null;
  isStatement: boolean;
  lockedInputClass: string;
  onLockedFieldClick: (() => void) | undefined;
  beneficiaryName: string;
  beneficiaryId: number | string;
  beneficiaries: Beneficiary[];
  amount: string;
  debitCredit: 'debit' | 'credit';
  txnDate: string;
  tags: FlatTag[];
  tagIds: number[];
  miscellaneousTagId: number | undefined;
  totalTagId: number | undefined;
  notes: string;
  bankAccountId: number | null;
  submitting: boolean;
  isDirty: boolean;
  dismissLabel: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onBeneficiaryChange: (name: string, bid: number | string) => void;
  onRequestAddBeneficiary: () => void;
  onAmountChange: (value: string) => void;
  onDebitCreditChange: (value: 'debit' | 'credit') => void;
  onTxnDateChange: (value: string) => void;
  onAddTag: (tid: number) => void;
  onRemoveTag: (tid: number) => void;
  onRequestAddTag: () => void;
  onNotesChange: (value: string) => void;
  onBankAccountChange: (value: number | null) => void;
  onCloseRequest: () => void;
}

// The edit form's render — error banner, locked-field banner, the field set
// (beneficiary / amount / type / date / tags / notes, each readOnly-locked
// when the txn came from a statement), and the footer. Split out of
// EditTransactionPage so that component stays under the complexity / cognitive
// gates; all state lives in the page and arrives via props. Each onChange is
// pre-wrapped by the page with the locked-banner clear.
function EditTransactionForm({
  error,
  lockedReason,
  isStatement,
  lockedInputClass,
  onLockedFieldClick,
  beneficiaryName,
  beneficiaryId,
  beneficiaries,
  amount,
  debitCredit,
  txnDate,
  tags,
  tagIds,
  miscellaneousTagId,
  totalTagId,
  notes,
  bankAccountId,
  submitting,
  isDirty,
  dismissLabel,
  onSubmit,
  onBeneficiaryChange,
  onRequestAddBeneficiary,
  onAmountChange,
  onDebitCreditChange,
  onTxnDateChange,
  onAddTag,
  onRemoveTag,
  onRequestAddTag,
  onNotesChange,
  onBankAccountChange,
  onCloseRequest,
}: EditTransactionFormProps) {
  return (
    <>
      {error && <div className="form-error mb-3">{error}</div>}

      <LockedFieldBanner reason={lockedReason} />

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Beneficiary search — readOnly when the txn comes from a
            statement (bank-owned). Click surfaces the lock banner. */}
        {isStatement ? (
          <div>
            <label htmlFor="beneficiary-locked" className="form-label">
              Beneficiary
            </label>
            <input
              id="beneficiary-locked"
              value={beneficiaryName}
              readOnly
              onClick={onLockedFieldClick}
              className={`form-input ${lockedInputClass}`}
            />
          </div>
        ) : (
          <BeneficiarySearch
            value={beneficiaryName}
            beneficiaryId={beneficiaryId}
            beneficiaries={beneficiaries}
            onChange={onBeneficiaryChange}
            onRequestAddBeneficiary={onRequestAddBeneficiary}
            required
          />
        )}

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
              readOnly={isStatement}
              onChange={(e) => onAmountChange(e.target.value)}
              onClick={onLockedFieldClick}
              className={`form-input ${lockedInputClass}`}
            />
          </div>
          <div>
            <label htmlFor="debit_credit" className="form-label">
              Type
            </label>
            {isStatement ? (
              <input
                id="debit_credit"
                name="debit_credit"
                value={debitCredit === 'debit' ? 'Debit' : 'Credit'}
                readOnly
                onClick={onLockedFieldClick}
                className={`form-input ${lockedInputClass}`}
              />
            ) : (
              <select
                id="debit_credit"
                name="debit_credit"
                value={debitCredit}
                onChange={(e) =>
                  onDebitCreditChange(e.target.value as 'debit' | 'credit')
                }
                className="form-input"
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="txn_date" className="form-label">
            Date
          </label>
          {isStatement ? (
            <input
              id="txn_date"
              name="txn_date"
              value={txnDate}
              readOnly
              onClick={onLockedFieldClick}
              className={`form-input ${lockedInputClass}`}
            />
          ) : (
            <DateField
              id="txn_date"
              name="txn_date"
              value={txnDate}
              onChange={onTxnDateChange}
            />
          )}
        </div>

        <TagSelector
          tags={tags}
          selectedTagIds={tagIds}
          miscellaneousTagId={miscellaneousTagId}
          totalTagId={totalTagId}
          onAdd={onAddTag}
          onRemove={onRemoveTag}
          onRequestAddTag={onRequestAddTag}
        />

        {!isStatement && (
          <BankAccountField
            id="bank-account-picker-edit"
            label="Bank account"
            value={bankAccountId}
            onChange={onBankAccountChange}
            helper="The backend doesn't yet return the saved bank account on edit — re-pick if you want to update it."
          />
        )}

        <div>
          <label htmlFor="notes" className="form-label">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            className="form-input resize-y"
          />
        </div>

        {/* DetailModal footer convention (Batch 9.8): Cancel/Close
            on the left of the right-cluster, Save on the right;
            buttons size to their content (no `w-full`). */}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCloseRequest}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {dismissLabel}
          </button>
          <button
            type="submit"
            disabled={submitting || !isDirty}
            className="btn-primary !w-auto"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  );
}
