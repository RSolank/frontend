import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import {
  addAccountIdentifierRequest,
  createBankAccountRequest,
  deleteAccountIdentifierRequest,
  updateBankAccountRequest,
} from '../api/mutations';
import {
  ACCOUNT_TYPE_LABEL,
  bankAccountToForm,
  emptyBankAccountForm,
  formToCreatePayload,
  formToUpdatePayload,
  USER_ACCOUNT_TYPES,
  type BankAccount,
  type BankAccountFormInput,
  type UserAccountType,
} from '../api/schemas';

import { IdentifierChips } from './IdentifierChips';

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (account: BankAccount) => void;
  // null = create mode; a row = edit mode (the dialog reads live
  // identifiers from the passed row + writes via the dedicated
  // identifier endpoints).
  account?: BankAccount | null;
  // Pre-fill helper for the statement-upload deep-link path
  // (`?register=<identifier>` on /settings/bank-accounts). Seeds a
  // single pending UPI identifier when creating. Ignored in edit
  // mode.
  initialIdentifier?: string;
  // Modal-header Remove-in-edit (conventions.md "Modal-header
  // destructive actions"). Parent owns the confirm flow.
  onRequestRemove?: () => void;
}

function saveLabel(saving: boolean, isEditing: boolean): string {
  if (saving) return 'Saving…';
  return isEditing ? 'Save changes' : 'Save account';
}

function describeApiError(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  if (e.status === 409)
    return 'That identifier is already attached to another of your accounts.';
  return e.detail || e.error || fallback;
}

function useBankAccountForm({
  open,
  account,
  initialIdentifier,
  onSaved,
  onClose,
}: {
  open: boolean;
  account: BankAccount | null;
  initialIdentifier: string;
  onSaved: (account: BankAccount) => void;
  onClose: () => void;
}) {
  const isEditing = account != null;
  const initial = useMemo<BankAccountFormInput>(
    () =>
      account
        ? bankAccountToForm(account)
        : emptyBankAccountForm(initialIdentifier || undefined),
    [account, initialIdentifier]
  );
  const [form, setForm] = useState<BankAccountFormInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(null);
    }
  }, [open, initial]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial]
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (account) {
        const patch = formToUpdatePayload(form, account);
        const saved = patch
          ? await updateBankAccountRequest(account.uid, patch)
          : account;
        onSaved(saved);
        onClose();
      } else {
        const payload = formToCreatePayload(form);
        if (!payload) {
          setError('Label is required.');
          return;
        }
        const saved = await createBankAccountRequest(payload);
        onSaved(saved);
        onClose();
      }
    } catch (err) {
      setError(describeApiError(err, 'Save failed'));
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
    setError,
    isDirty,
    handleSave,
  };
}

export function BankAccountFormDialog({
  open,
  onClose,
  onSaved,
  account = null,
  initialIdentifier = '',
  onRequestRemove,
}: Props) {
  const {
    isEditing,
    form,
    setForm,
    saving,
    error,
    setError,
    isDirty,
    handleSave,
  } = useBankAccountForm({
    open,
    account,
    initialIdentifier,
    onSaved,
    onClose,
  });

  const [identifierInput, setIdentifierInput] = useState('');
  const [identifierBusy, setIdentifierBusy] = useState(false);

  useEffect(() => {
    if (open) setIdentifierInput('');
  }, [open]);

  const canSave =
    form.label.trim().length > 0 && !saving && (!isEditing || isDirty);

  async function handleAddIdentifier() {
    const value = identifierInput.trim();
    if (!value) return;

    if (!isEditing) {
      // Create mode — splice into pending list; the POST send the
      // batch inline.
      if (form.pendingIdentifiers.some((p) => p.identifier === value)) {
        setError('That identifier is already pending on this account.');
        return;
      }
      setError(null);
      setForm({
        ...form,
        pendingIdentifiers: [
          ...form.pendingIdentifiers,
          { identifier: value, identifier_type: 'UPI' },
        ],
      });
      setIdentifierInput('');
      return;
    }
    if (!account) return;
    setIdentifierBusy(true);
    setError(null);
    try {
      const saved = await addAccountIdentifierRequest(account.uid, {
        identifier: value,
        identifier_type: 'UPI',
      });
      onSaved({ ...account, identifiers: [...account.identifiers, saved] });
      setIdentifierInput('');
    } catch (err) {
      setError(describeApiError(err, 'Failed to add identifier.'));
    } finally {
      setIdentifierBusy(false);
    }
  }

  async function handleRemoveIdentifier(uid: number) {
    if (!account) return;
    setIdentifierBusy(true);
    setError(null);
    try {
      await deleteAccountIdentifierRequest(account.uid, uid);
      onSaved({
        ...account,
        identifiers: account.identifiers.filter((i) => i.uid !== uid),
      });
    } catch (err) {
      setError(describeApiError(err, 'Failed to remove identifier.'));
    } finally {
      setIdentifierBusy(false);
    }
  }

  const title = isEditing ? 'Edit bank account' : 'New bank account';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      confirmOnDirty
      isDirty={isDirty}
      headerActions={
        isEditing && onRequestRemove ? (
          <button
            type="button"
            onClick={onRequestRemove}
            title="Remove account"
            aria-label="Remove account"
            className="text-danger-600 hover:bg-danger-50 focus-visible:ring-danger-500 dark:text-danger-400 dark:hover:bg-danger-950/40 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isDirty ? 'Cancel' : 'Close'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="bank-account-save"
          >
            {saveLabel(saving, isEditing)}
          </button>
        </div>
      }
    >
      <BankAccountFormBody
        form={form}
        setForm={setForm}
        account={account}
        isEditing={isEditing}
        identifierInput={identifierInput}
        setIdentifierInput={setIdentifierInput}
        identifierBusy={identifierBusy}
        onAddIdentifier={handleAddIdentifier}
        onRemoveLiveIdentifier={(uid) => void handleRemoveIdentifier(uid)}
        error={error}
      />
    </Modal>
  );
}

interface BodyProps {
  form: BankAccountFormInput;
  setForm: (next: BankAccountFormInput) => void;
  account: BankAccount | null;
  isEditing: boolean;
  identifierInput: string;
  setIdentifierInput: (next: string) => void;
  identifierBusy: boolean;
  onAddIdentifier: () => void;
  onRemoveLiveIdentifier: (uid: number) => void;
  error: string | null;
}

function BankAccountFormBody({
  form,
  setForm,
  account,
  isEditing,
  identifierInput,
  setIdentifierInput,
  identifierBusy,
  onAddIdentifier,
  onRemoveLiveIdentifier,
  error,
}: BodyProps) {
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Label">
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="e.g. HDFC Savings"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          data-testid="bank-account-label"
        />
      </FormField>
      <FormField label="Type">
        <select
          value={form.account_type}
          onChange={(e) =>
            setForm({
              ...form,
              account_type: e.target.value as UserAccountType,
            })
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          data-testid="bank-account-type"
        >
          {USER_ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </FormField>
      <CommitteeCheckbox
        checked={form.is_committee_account}
        onChange={(next) => setForm({ ...form, is_committee_account: next })}
      />
      <IdentifiersFieldset
        isEditing={isEditing}
        liveIdentifiers={account?.identifiers ?? []}
        pendingIdentifiers={form.pendingIdentifiers}
        identifierInput={identifierInput}
        setIdentifierInput={setIdentifierInput}
        identifierBusy={identifierBusy}
        onAddIdentifier={onAddIdentifier}
        onRemoveLiveIdentifier={onRemoveLiveIdentifier}
        onRemovePending={(identifier) =>
          setForm({
            ...form,
            pendingIdentifiers: form.pendingIdentifiers.filter(
              (p) => p.identifier !== identifier
            ),
          })
        }
      />
      {error && (
        <p
          role="alert"
          className="bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-300 rounded-md px-3 py-2 text-sm"
          data-testid="bank-account-form-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function CommitteeCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className="flex items-start gap-2 text-sm"
      htmlFor="bank-account-committee"
    >
      <input
        id="bank-account-committee"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
        aria-label="Tax-pot account"
        data-testid="bank-account-committee"
      />
      <span className="flex flex-col">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Tax-pot account
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Self-transfers to this account&apos;s identifiers auto-acquire the
          consumption-tax-paid tag. Only one account can be the tax-pot at a
          time — turning this on demotes the previous one.
        </span>
      </span>
    </label>
  );
}

interface IdentifiersFieldsetProps {
  isEditing: boolean;
  liveIdentifiers: BankAccount['identifiers'];
  pendingIdentifiers: BankAccountFormInput['pendingIdentifiers'];
  identifierInput: string;
  setIdentifierInput: (next: string) => void;
  identifierBusy: boolean;
  onAddIdentifier: () => void;
  onRemoveLiveIdentifier: (uid: number) => void;
  onRemovePending: (identifier: string) => void;
}

function IdentifiersFieldset({
  isEditing,
  liveIdentifiers,
  pendingIdentifiers,
  identifierInput,
  setIdentifierInput,
  identifierBusy,
  onAddIdentifier,
  onRemoveLiveIdentifier,
  onRemovePending,
}: IdentifiersFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <legend className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Identifiers
      </legend>
      <IdentifierChips
        identifiers={isEditing ? liveIdentifiers : pendingIdentifiers}
        onRemove={(identifier) => {
          if (isEditing && 'uid' in identifier) {
            onRemoveLiveIdentifier(identifier.uid);
          } else {
            onRemovePending(identifier.identifier);
          }
        }}
        busy={identifierBusy}
      />
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={identifierInput}
          onChange={(e) => setIdentifierInput(e.target.value)}
          placeholder="user@upi"
          aria-label="New UPI identifier"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          data-testid="bank-account-identifier-input"
        />
        <button
          type="button"
          onClick={onAddIdentifier}
          disabled={identifierInput.trim().length === 0 || identifierBusy}
          className="focus-visible:ring-accent-500 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          data-testid="bank-account-identifier-add"
        >
          <Plus size={14} aria-hidden />
          Add UPI
        </button>
      </div>
    </fieldset>
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
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}
