import { MoreHorizontal, Wallet } from 'lucide-react';

import {
  ACCOUNT_TYPE_LABEL,
  type BankAccount,
} from '../api/schemas';

interface Props {
  account: BankAccount;
  highlighted?: boolean;
  onOpenDetail: () => void;
}

// One row per bank account. Click the ⋯ trigger (DetailModal
// convention) to open the form dialog as the canonical view +
// edit surface. Identifier chips render inline so the user
// doesn't have to open the modal to confirm the UPI handles
// already attached.
export function BankAccountRow({ account, highlighted = false, onOpenDetail }: Props) {
  const highlightClass = highlighted ? 'ring-2 ring-indigo-500 ring-inset' : '';
  return (
    <li
      data-testid={`bank-account-row-${account.uid}`}
      className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 transition-shadow dark:border-slate-800 dark:bg-slate-900 ${highlightClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-indigo-500" aria-hidden />
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {account.label}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {ACCOUNT_TYPE_LABEL[account.account_type]}
          </span>
          {account.is_committee_account && (
            <span
              data-testid={`bank-account-committee-badge-${account.uid}`}
              className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              Tax-pot
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label="Open details"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          data-testid={`bank-account-open-${account.uid}`}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      {account.identifiers.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {account.identifiers.map((id) => (
            <li key={id.uid}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                <span className="rounded-sm bg-indigo-100 px-1 py-0.5 font-mono text-[10px] uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {id.identifier_type}
                </span>
                <span className="font-mono text-slate-700 dark:text-slate-200">
                  {id.identifier}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
