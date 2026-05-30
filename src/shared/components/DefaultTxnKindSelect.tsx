import {
  useDefaultTxnKindStore,
  type DefaultTxnKind,
} from '../state/defaultTxnKind.store';

const OPTIONS: { value: DefaultTxnKind; label: string }[] = [
  { value: 'debit', label: 'Debit (money out)' },
  { value: 'credit', label: 'Credit (money in)' },
];

// Initial value of the Add Transaction form's debit/credit field.
// Frontend-only Zustand persist; defaults to 'debit'.
export function DefaultTxnKindSelect() {
  const kind = useDefaultTxnKindStore((s) => s.kind);
  const setKind = useDefaultTxnKindStore((s) => s.setKind);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <label
        htmlFor="default-txn-kind-select"
        className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
      >
        Add transaction defaults to
      </label>
      <select
        id="default-txn-kind-select"
        value={kind}
        onChange={(e) => setKind(e.target.value as DefaultTxnKind)}
        className="form-input !w-auto"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
