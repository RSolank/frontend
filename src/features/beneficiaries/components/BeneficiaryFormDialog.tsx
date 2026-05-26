import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import {
  createBeneficiaryRequest,
  updateBeneficiaryRequest,
} from '../api/mutations';
import type { Beneficiary } from '../api/queries';
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
}

// Unified create/edit dialog for beneficiaries. Replaces the
// post-Batch-6 CreateBeneficiaryDialog (which was create-only) and
// makes the list page's "modal-first CRUD" contract real.
export function BeneficiaryFormDialog({
  open,
  onClose,
  onSaved,
  beneficiary = null,
  initialName = '',
  initialType = 'merchant',
  onRequestMerge,
  onRequestRemove,
}: BeneficiaryFormDialogProps) {
  const isEditing = beneficiary != null;
  const [form, setForm] = useState<BeneficiaryFormInput>(() =>
    beneficiary
      ? beneficiaryToForm(beneficiary)
      : { ...emptyBeneficiaryForm(initialType), name: initialName }
  );
  const [aliasesInvalid, setAliasesInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        beneficiary
          ? beneficiaryToForm(beneficiary)
          : { ...emptyBeneficiaryForm(initialType), name: initialName }
      );
      setAliasesInvalid(false);
      setError(null);
      setSaving(false);
    }
  }, [open, beneficiary, initialName, initialType]);

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
        ? await updateBeneficiaryRequest(String(beneficiary!.uid), formToPayload(form))
        : await createBeneficiaryRequest(formToPayload(form));
      onSaved(saved);
      onClose();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save beneficiary');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isEditing ? 'Edit beneficiary' : 'Add new beneficiary'}
      headerActions={
        isEditing && onRequestRemove ? (
          <button
            type="button"
            onClick={onRequestRemove}
            disabled={saving}
            aria-label="Remove beneficiary"
            title="Remove beneficiary"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
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
              className="mr-auto rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
            >
              Merge…
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || aliasesInvalid || !form.name.trim()}
            className="btn-primary !w-auto"
          >
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save beneficiary'}
          </button>
        </>
      }
    >
      <BeneficiaryFormFields
        form={form}
        setForm={setForm}
        excludeUid={beneficiary?.uid ?? null}
        onAliasValidityChange={setAliasesInvalid}
      />
      {error && <div className="form-error mt-2">{error}</div>}
    </Modal>
  );
}
