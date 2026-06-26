import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { ModalReveal, RevealField } from '../../../shared/motion/ModalReveal';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { todayInUserTz } from '../../../shared/utils/dateUtils';
import { useBeneficiariesQuery } from '../../beneficiaries/api/queries';
import {
  createRecurringTemplateRequest,
  updateRecurringTemplateRequest,
} from '../api/mutations';
import {
  emptyRecurringForm,
  formToCreatePayload,
  RECURRING_CADENCES,
  templateToForm,
  type RecurringCadence,
  type RecurringDirection,
  type RecurringTemplate,
  type RecurringTemplateFormInput,
  type RecurringTemplateUpdatePayload,
} from '../api/schemas';

import { CadenceAnchorField } from './CadenceAnchorField';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface RecurringFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (template: RecurringTemplate) => void;
  // null = create mode; a row = edit mode (transfers ownership on PATCH).
  template?: RecurringTemplate | null;
  // Modal-header Remove-in-edit (conventions.md "Modal-header
  // destructive actions"). The page owns the confirm flow.
  onRequestRemove?: () => void;
  // Modal motion origin (T-nav-ia-reorg #6): the dialog grows out of — and
  // collapses back onto — this element (the Add CTA, or the clicked row in
  // edit mode). Forwarded to <Modal>.
  originRef?: React.RefObject<HTMLElement | null>;
}

function saveLabel(saving: boolean, isEditing: boolean): string {
  if (saving) return 'Saving…';
  return isEditing ? 'Save changes' : 'Save template';
}

interface UseFormArgs {
  open: boolean;
  template: RecurringTemplate | null;
  defaultDate: string;
  onSaved: (template: RecurringTemplate) => void;
  onClose: () => void;
}

// View-model hook — owns the form state, dirtiness, save flow, and
// derived title / save-gating. Pulled out so the dialog body stays a
// thin render under the complexity gate.
function useRecurringForm({
  open,
  template,
  defaultDate,
  onSaved,
  onClose,
}: UseFormArgs) {
  const isEditing = template != null;
  const initial = useMemo<RecurringTemplateFormInput>(
    () =>
      template ? templateToForm(template) : emptyRecurringForm(defaultDate),
    [template, defaultDate]
  );
  const [form, setForm] = useState<RecurringTemplateFormInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(null);
    }
  }, [open, initial]);

  const payload = useMemo(() => formToCreatePayload(form), [form]);
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial]
  );
  const canSave = payload !== null && (!isEditing || isDirty);

  async function handleSave() {
    if (!payload) return;
    setSaving(true);
    setError(null);
    try {
      const saved = template
        ? await updateRecurringTemplateRequest(
            template.uid,
            payload as RecurringTemplateUpdatePayload
          )
        : await createRecurringTemplateRequest(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return {
    isEditing,
    form,
    setForm,
    saving,
    error,
    isDirty,
    canSave,
    handleSave,
  };
}

export function RecurringFormDialog({
  open,
  onClose,
  onSaved,
  template = null,
  onRequestRemove,
  originRef,
}: RecurringFormDialogProps) {
  const timezone = usePreferencesStore((s) => s.timezone);
  const defaultDate = useMemo(() => todayInUserTz(timezone), [timezone]);
  const benQuery = useBeneficiariesQuery();

  const {
    isEditing,
    form,
    setForm,
    saving,
    error,
    isDirty,
    canSave,
    handleSave,
  } = useRecurringForm({ open, template, defaultDate, onSaved, onClose });

  const beneficiaryOptions = useMemo(
    () =>
      (benQuery.data ?? []).map((b) => ({
        value: String(b.uid),
        label: b.name,
      })),
    [benQuery.data]
  );

  const title = isEditing
    ? 'Edit recurring template'
    : 'New recurring template';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      originRef={originRef}
      confirmOnDirty
      isDirty={isDirty}
      headerActions={
        isEditing && onRequestRemove ? (
          <button
            type="button"
            onClick={onRequestRemove}
            title="Remove template"
            aria-label="Remove template"
            className="tap-press text-danger-600 hover:bg-danger-50 focus-visible:ring-danger-500 dark:text-danger-400 dark:hover:bg-danger-950/40 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Trash2 size={16} />
          </button>
        ) : null
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap-press rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isDirty ? 'Cancel' : 'Close'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="tap-press bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveLabel(saving, isEditing)}
          </button>
        </div>
      }
    >
      <RecurringFormBody
        form={form}
        setForm={setForm}
        beneficiaryOptions={beneficiaryOptions}
        benLoading={benQuery.isLoading}
        error={error}
      />
    </Modal>
  );
}

interface RecurringFormBodyProps {
  form: RecurringTemplateFormInput;
  setForm: React.Dispatch<React.SetStateAction<RecurringTemplateFormInput>>;
  beneficiaryOptions: { value: string; label: string }[];
  benLoading: boolean;
  error: string | null;
}

// The form fields, split out of the dialog so it renders as a CHILD of <Modal>
// — that's what lets the reveal read the Modal's settled signal and run the
// rise once data is ready (T-nav-ia-reorg #6 three-beat). Each field group is a
// <RevealField>; outside a Modal (or reduced motion) the phase is 'static' →
// fields render final. The rise gates on `!benLoading` so the Beneficiary
// dropdown doesn't pop its options mid-animation.
function RecurringFormBody({
  form,
  setForm,
  beneficiaryOptions,
  benLoading,
  error,
}: RecurringFormBodyProps) {
  return (
    <ModalReveal className="flex flex-col gap-3" ready={!benLoading}>
      <RevealField>
        <FormField label="Beneficiary">
          <SearchableSelect
            ariaLabel="Beneficiary"
            value={
              form.beneficiary_id == null ? '' : String(form.beneficiary_id)
            }
            options={beneficiaryOptions}
            onChange={(v) =>
              setForm({ ...form, beneficiary_id: v === '' ? null : Number(v) })
            }
            placeholder={benLoading ? 'Loading…' : 'Pick a beneficiary'}
          />
        </FormField>
      </RevealField>
      <RevealField className="grid grid-cols-2 gap-3">
        <FormField label="Direction">
          <select
            value={form.debit_credit}
            onChange={(e) =>
              setForm({
                ...form,
                debit_credit: e.target.value as RecurringDirection,
              })
            }
            className="form-input"
          >
            <option value="debit">Debit (expense)</option>
            <option value="credit">Credit (income)</option>
          </select>
        </FormField>
        <FormField label="Cadence">
          <select
            value={form.cadence}
            onChange={(e) =>
              setForm({
                ...form,
                cadence: e.target.value as RecurringCadence,
              })
            }
            className="form-input"
          >
            {RECURRING_CADENCES.map((c) => (
              <option key={c} value={c}>
                {c[0] + c.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </FormField>
      </RevealField>
      <RevealField className="grid grid-cols-2 gap-3">
        <FormField label="Expected amount">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.expected_amount}
            onChange={(e) =>
              setForm({ ...form, expected_amount: e.target.value })
            }
            className="form-input"
          />
        </FormField>
        <FormField label="Next due date">
          <input
            type="date"
            value={form.next_due_date}
            onChange={(e) =>
              setForm({ ...form, next_due_date: e.target.value })
            }
            className="form-input"
          />
        </FormField>
      </RevealField>
      <RevealField>
        <CadenceAnchorField form={form} onChange={setForm} />
      </RevealField>
      {error && (
        <RevealField>
          <p
            role="alert"
            className="bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-300 rounded-md px-3 py-2 text-sm"
          >
            {error}
          </p>
        </RevealField>
      )}
    </ModalReveal>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}
