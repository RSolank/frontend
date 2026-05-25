import { useEffect, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { createBeneficiaryRequest } from '../api/mutations';
import type { Beneficiary } from '../api/queries';
import {
  emptyBeneficiaryForm,
  formToPayload,
  type BeneficiaryFormInput,
} from '../api/schemas';

import { BeneficiaryFormFields } from './BeneficiaryFormFields';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface CreateBeneficiaryDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (beneficiary: Beneficiary) => void;
  // Pre-fill the Name field — typically from a parent search input.
  initialName?: string;
  initialType?: 'merchant' | 'person';
}

// Reusable create-only flow for beneficiaries. Wraps BeneficiaryFormFields
// + a Save/Cancel footer in a modal so callers (e.g. the categorization
// rules page) can add a missing beneficiary inline without losing their
// in-flight form state. Edit is intentionally not supported here — the
// dedicated detail page at /beneficiaries/:id handles that.
export function CreateBeneficiaryDialog({
  open,
  onClose,
  onCreated,
  initialName = '',
  initialType = 'merchant',
}: CreateBeneficiaryDialogProps) {
  const [form, setForm] = useState<BeneficiaryFormInput>(() => ({
    ...emptyBeneficiaryForm(initialType),
    name: initialName,
  }));
  const [aliasesInvalid, setAliasesInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyBeneficiaryForm(initialType), name: initialName });
      setAliasesInvalid(false);
      setError(null);
      setSaving(false);
    }
  }, [open, initialName, initialType]);

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
      const beneficiary = await createBeneficiaryRequest(formToPayload(form));
      onCreated(beneficiary);
      onClose();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to create beneficiary');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add new beneficiary"
      footer={
        <>
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
            {saving ? 'Saving…' : 'Save beneficiary'}
          </button>
        </>
      }
    >
      <BeneficiaryFormFields
        form={form}
        setForm={setForm}
        onAliasValidityChange={setAliasesInvalid}
      />
      {error && <div className="form-error mt-2">{error}</div>}
    </Modal>
  );
}
