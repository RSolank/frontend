import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DateField } from '../../../shared/components/DateField';
import { LockedFieldBanner } from '../../../shared/components/LockedFieldBanner';
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
import type { CreatedTag } from '../../tags/api/mutations';
import {
  fetchTagConstants,
  fetchTags,
  type TagConstants,
  type TagNode,
} from '../../tags/api/queries';
import { tagKeys } from '../../tags/api/keys';
import { TagFormDialog } from '../../tags/components/TagFormDialog';
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
  const [tagIds, setTagIds] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // Locked-field banner state. Surfaces on click of a readOnly field;
  // cleared automatically on the first successful edit. See the
  // LockedFieldBanner component for the auto-dismiss contract.
  const [lockedReason, setLockedReason] = useState<string | null>(null);

  // Snapshot of the form fields at load time. Used for the Cancel
  // (revert to loaded values) flow + the isDirty diff.
  const initialSnapshotRef = useRef<{
    amount: string;
    debitCredit: 'debit' | 'credit';
    beneficiaryName: string;
    beneficiaryId: number | string;
    txnDate: string;
    notes: string;
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
      const numericId = Number(id);
      if (Number.isFinite(numericId)) onSaved?.(numericId);
      // Row-highlight on the parent list communicates success; close
      // the modal cleanly.
      dismiss();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to update');
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
    if (sortedKey(tagIds) !== sortedKey(snap.tagIds)) return true;
    return false;
  }, [
    amount,
    debitCredit,
    beneficiaryName,
    beneficiaryId,
    txnDate,
    notes,
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
    if (!window.confirm('Discard unsaved changes?')) return;
    dismiss();
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
      {error && <div className="form-error mb-3">{error}</div>}

      <LockedFieldBanner reason={lockedReason} />

      <form onSubmit={handleSubmit} className="space-y-4">
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
              onChange={(name, bid) => {
                clearLockedBannerOnEdit();
                setBeneficiaryName(name);
                setBeneficiaryId(bid);
              }}
              onRequestAddBeneficiary={() => setCreateBeneficiaryOpen(true)}
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
                onChange={(e) => {
                  clearLockedBannerOnEdit();
                  setAmount(e.target.value);
                }}
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
                  onChange={(e) => {
                    clearLockedBannerOnEdit();
                    setDebitCredit(e.target.value as 'debit' | 'credit');
                  }}
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
                onChange={(next) => {
                  clearLockedBannerOnEdit();
                  setTxnDate(next);
                }}
              />
            )}
          </div>

          <TagSelector
            tags={tags}
            selectedTagIds={tagIds}
            miscellaneousTagId={constants?.MISCELLANEOUS_TAG_ID as number | undefined}
            totalTagId={constants?.TOTAL_TAG_ID as number | undefined}
            onAdd={(tid) => {
              clearLockedBannerOnEdit();
              handleAddTag(tid);
            }}
            onRemove={(tid) => {
              clearLockedBannerOnEdit();
              handleRemoveTag(tid);
            }}
            onRequestAddTag={() => setCreateTagOpen(true)}
          />

          <div>
            <label htmlFor="notes" className="form-label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => {
                clearLockedBannerOnEdit();
                setNotes(e.target.value);
              }}
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
              onClick={handleCloseRequest}
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
}
