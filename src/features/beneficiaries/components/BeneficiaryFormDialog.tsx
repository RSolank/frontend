import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import {
  createBeneficiaryRequest,
  updateBeneficiaryRequest,
  updateCategorizationRuleTags,
} from '../api/mutations';
import { fetchCategorizationRules, type Beneficiary } from '../api/queries';
import {
  beneficiaryToForm,
  emptyBeneficiaryForm,
  formToPayload,
  type BeneficiaryFormInput,
} from '../api/schemas';

import { BeneficiaryFormFields } from './BeneficiaryFormFields';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

// Point a freshly-created person's auto rule at the chosen category (best
// effort — a failure leaves the BE's Other Transfer default in place).
async function syncNewPersonRule(
  beneficiaryUid: number,
  tagId: number
): Promise<void> {
  try {
    const res = await fetchCategorizationRules();
    const rule = (res.rules || []).find(
      (r) => r.beneficiary_id === beneficiaryUid
    );
    if (rule) await updateCategorizationRuleTags(rule.uid, [tagId]);
  } catch (err) {
    console.error('Failed to sync new person category', err);
  }
}

// Save-button label by state — if/else (not a nested ternary) so it stays off
// sonarjs/no-nested-conditional.
function saveLabel(saving: boolean, isEditing: boolean): string {
  if (saving) return 'Saving…';
  return isEditing ? 'Save changes' : 'Save beneficiary';
}

interface BeneficiaryFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (beneficiary: Beneficiary) => void;
  // When set, the dialog edits this beneficiary; when null, it creates.
  beneficiary?: Beneficiary | null;
  // Pre-fill Name when creating — typically from a parent search input.
  initialName?: string;
  initialType?: 'merchant' | 'person';
  // When editing, surface a "Merge with another beneficiary" button in
  // the footer. The caller owns the merge UI (typically by opening
  // <MergeBeneficiariesDialog />) and provides this handler.
  onRequestMerge?: () => void;
  // Modal-header Remove-in-edit convention (CONTRIBUTING.md §6).
  // When set, an icon-only Trash button renders in the modal header
  // for edit mode. Parent owns the confirm + mutation flow.
  onRequestRemove?: () => void;
  // Modal motion origin (T-nav-ia-reorg #6): the dialog grows out of — and
  // collapses back onto — this element (the Add CTA, or the clicked row in
  // edit mode). Forwarded to <Modal>.
  originRef?: React.RefObject<HTMLElement | null>;
}

interface UseBeneficiaryFormArgs {
  open: boolean;
  beneficiary: Beneficiary | null;
  initialName: string;
  initialType: 'merchant' | 'person';
  onSaved: (beneficiary: Beneficiary) => void;
  onClose: () => void;
}

// View-model: owns the form state, dirtiness, save flow, and the derived
// title / dismiss-label / canSave gate. Hoisting this out of the component
// keeps all the branching plumbing here and leaves the dialog a thin render
// (component cyclomatic complexity stays under the gate).
function useBeneficiaryForm({
  open,
  beneficiary,
  initialName,
  initialType,
  onSaved,
  onClose,
}: UseBeneficiaryFormArgs) {
  const isEditing = beneficiary != null;
  const initialForm = useMemo<BeneficiaryFormInput>(
    () =>
      beneficiary
        ? beneficiaryToForm(beneficiary)
        : { ...emptyBeneficiaryForm(initialType), name: initialName },
    [beneficiary, initialName, initialType]
  );
  const [form, setForm] = useState<BeneficiaryFormInput>(initialForm);
  // Mutable baseline for the dirty check. Starts at `initialForm`, but a person's
  // category is seeded ASYNC from its categorization rule (no person.category
  // column) in BeneficiaryFormFields — that's persisted state, not a user edit,
  // so `syncBaselineCategory` folds it into the baseline (only when empty) to
  // stop it reading as a spurious change.
  const [baseline, setBaseline] = useState<BeneficiaryFormInput>(initialForm);
  const [aliasesInvalid, setAliasesInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setBaseline(initialForm);
      setAliasesInvalid(false);
      setError(null);
      setSaving(false);
    }
  }, [open, initialForm]);

  const syncBaselineCategory = useCallback((category: string) => {
    // Only fill an empty baseline category (the person-seed case); never
    // overwrite a merchant's already-loaded category.
    setBaseline((b) => (b.category ? b : { ...b, category }));
  }, []);

  // Honest "did the user change anything from the baseline" — drives the
  // discard-confirm + dismiss label. NOT the Save gate (a pristine create must
  // not prompt on close, but a prefilled create must still be saveable — see
  // canSave, which gates create on validity instead of dirtiness).
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (aliasesInvalid) {
      setError('One or more aliases are duplicates — please resolve them');
      return;
    }
    setSaving(true);
    try {
      const saved = isEditing
        ? await updateBeneficiaryRequest(
            String(beneficiary.uid),
            formToPayload(form)
          )
        : await createBeneficiaryRequest(formToPayload(form));
      // A NEW person gets an auto-created Other Transfer rule on the BE; if the
      // user chose a different category in the form, point that rule at it
      // (merchants persist their category via the payload; persons have no
      // category column, so the FE syncs the rule directly).
      if (!isEditing && form.beneficiary_type === 'person' && form.category) {
        await syncNewPersonRule(saved.uid, Number(form.category));
      }
      onSaved(saved);
      // Row-highlight on the parent surfaces the saved state; close
      // cleanly.
      onClose();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save beneficiary');
    } finally {
      setSaving(false);
    }
  }

  return {
    form,
    setForm,
    setAliasesInvalid,
    syncBaselineCategory,
    isEditing,
    isDirty,
    saving,
    error,
    // Title = the beneficiary's name (or "New beneficiary" in Add).
    title: isEditing ? beneficiary.name || 'Beneficiary' : 'New beneficiary',
    dismissLabel: isDirty ? 'Cancel' : 'Close',
    // Single source of truth for the Save button's enabled state.
    canSave:
      !saving &&
      !aliasesInvalid &&
      (!isEditing || isDirty) &&
      Boolean(form.name.trim()),
    handleSave,
  };
}

// Unified create/edit dialog for beneficiaries. Always renders the
// form per the Batch 9.8 DetailModal convention — visual layout is
// identical whether the modal was just opened or has pending edits.
// Every beneficiary field is editable so the LockedFieldBanner
// doesn't apply here, but the rest of the pattern (title = entity
// name, single dismiss text-swap, Save gated by isDirty) holds.
export function BeneficiaryFormDialog({
  open,
  onClose,
  onSaved,
  beneficiary = null,
  initialName = '',
  initialType = 'merchant',
  onRequestMerge,
  onRequestRemove,
  originRef,
}: BeneficiaryFormDialogProps) {
  const {
    form,
    setForm,
    setAliasesInvalid,
    syncBaselineCategory,
    isEditing,
    isDirty,
    saving,
    error,
    title,
    dismissLabel,
    canSave,
    handleSave,
  } = useBeneficiaryForm({
    open,
    beneficiary,
    initialName,
    initialType,
    onSaved,
    onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={title}
      originRef={originRef}
      confirmOnDirty
      isDirty={isDirty}
      headerActions={
        isEditing && onRequestRemove ? (
          <button
            type="button"
            onClick={onRequestRemove}
            disabled={saving}
            aria-label="Remove beneficiary"
            title="Remove beneficiary"
            className="tap-press text-danger-600 hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-500 dark:text-danger-400 dark:hover:bg-danger-950/40 dark:hover:text-danger-300 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="beneficiary-form-remove"
          >
            <Trash2 aria-hidden size={16} />
          </button>
        ) : null
      }
      footer={
        <>
          {isEditing && onRequestMerge && (
            <button
              type="button"
              onClick={onRequestMerge}
              disabled={saving}
              className="tap-press border-warning-300 bg-warning-50 text-warning-800 hover:bg-warning-100 dark:border-warning-900/50 dark:bg-warning-950/40 dark:text-warning-300 dark:hover:bg-warning-950/60 mr-auto rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              Merge…
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="tap-press rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {dismissLabel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="tap-press btn-primary !w-auto"
          >
            {saveLabel(saving, isEditing)}
          </button>
        </>
      }
    >
      <BeneficiaryFormFields
        // Remount on every beneficiary switch so the child's internal state
        // (ruleTags, the seeded category, loadedCount) can't bleed from the
        // previously-opened one. The Modal keeps content mounted through its
        // exit animation, so a quick close→reopen would otherwise reuse the same
        // instance and flash the prior beneficiary's category + chips
        // (T-nav-ia-reorg #6 stale-form fix).
        key={beneficiary?.uid ?? 'new'}
        form={form}
        setForm={setForm}
        excludeUid={beneficiary?.uid ?? null}
        onAliasValidityChange={setAliasesInvalid}
        onSyncBaselineCategory={syncBaselineCategory}
      />
      {error && <div className="form-error mt-2">{error}</div>}
    </Modal>
  );
}
