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
