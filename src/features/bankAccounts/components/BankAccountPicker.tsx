import { useBankAccountsQuery } from '../api/queries';

interface Props {
  // Currently-selected bank account uid, or `null` for "no
  // account". Pass `null` initially when the user hasn't picked
  // anything yet — the picker renders as the placeholder option.
  value: number | null;
  onChange: (next: number | null) => void;
  // Optional id for label association.
  id?: string;
  // When the user has no accounts AND the picker is rendered,
  // hide the empty `<select>` entirely (no point asking the user
  // to pick from a one-row "No account" list). The parent form
  // omits `bank_account_id` from the payload too.
  hideWhenEmpty?: boolean;
  // Disabled state — used by EditTransaction when the BE doesn't
  // yet return the saved `bank_account_id` (Batch 13 BE handoff
  // item); the picker renders as read-only with a helper note.
  disabled?: boolean;
}

// Manual-txn bank-account picker (Batch 13f). Lists the user's
// non-archived bank accounts; `null` = "No account" (the BE
// `transactions.bank_account_id` column is nullable per Decision
// 27 — taxation engine works fine with zero accounts).
//
// The committee account is annotated with a "Tax-pot" suffix in
// the label so the user knows which selection drives the
// consumption-tax auto-tagging behaviour.
export function BankAccountPicker({
  value,
  onChange,
  id,
  hideWhenEmpty = true,
  disabled = false,
}: Props) {
  const query = useBankAccountsQuery();
  const accounts = (query.data ?? []).filter((a) => a.archived_at === null);

  if (query.isLoading) return null;
  if (accounts.length === 0 && hideWhenEmpty) return null;

  return (
    <select
      id={id}
      value={value === null ? '' : String(value)}
      onChange={(e) =>
        onChange(e.target.value === '' ? null : Number(e.target.value))
      }
      disabled={disabled}
      aria-label="Bank account"
      data-testid="bank-account-picker"
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <option value="">No account</option>
      {accounts.map((a) => (
        <option key={a.uid} value={a.uid}>
          {a.label}
          {a.is_committee_account ? ' · Tax-pot' : ''}
        </option>
      ))}
    </select>
  );
}
