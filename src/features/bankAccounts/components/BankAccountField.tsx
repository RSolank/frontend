import { useBankAccountsQuery } from '../api/queries';

import { BankAccountPicker } from './BankAccountPicker';

interface Props {
  id: string;
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  // Helper text rendered below the picker — e.g. EditTransaction
  // notes that the BE doesn't yet return the saved
  // `bank_account_id`, so the picker defaults to "No account"
  // until the user re-picks (Batch 13 BE handoff).
  helper?: string;
  disabled?: boolean;
}

// Self-contained form field — label + picker + (optional) helper
// text in one mountable unit. Hides the entire field (label and
// all) when the user has no bank accounts so an orphan label
// doesn't sit alone above an empty picker.
//
// The Add / Edit transaction forms each mount one of these once
// the bank-accounts feature is on; the field renders nothing
// until at least one account exists (which is the common cold-
// start case for new users).
export function BankAccountField({
  id,
  label,
  value,
  onChange,
  helper,
  disabled = false,
}: Props) {
  const query = useBankAccountsQuery();
  const accounts = (query.data ?? []).filter((a) => a.archived_at === null);
  if (query.isLoading || accounts.length === 0) return null;

  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
        <span className="ml-1 text-xs font-normal text-slate-500">
          (optional)
        </span>
      </label>
      <BankAccountPicker
        id={id}
        value={value}
        onChange={onChange}
        hideWhenEmpty={false}
        disabled={disabled}
      />
      {helper && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      )}
    </div>
  );
}
