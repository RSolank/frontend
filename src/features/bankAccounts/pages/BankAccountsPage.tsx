import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { bankAccountKeys } from '../api/keys';
import { deleteBankAccountRequest } from '../api/mutations';
import { useBankAccountsQuery } from '../api/queries';
import type { BankAccount } from '../api/schemas';
import { BankAccountFormDialog } from '../components/BankAccountFormDialog';
import { BankAccountRow } from '../components/BankAccountRow';
import { TaxPotNudge } from '../components/TaxPotNudge';

// /settings/bank-accounts — CRUD list for the user's bank accounts.
// Each row is a compact card with label / type / committee badge /
// identifier chips + a ⋯ trigger that opens the form dialog as the
// canonical view + edit surface (DetailModal convention).
//
// Deep-link path from the statement-upload `suggest_register_account`
// banner: `/settings/bank-accounts?register=<identifier>` opens the
// Add modal pre-filled with one pending UPI identifier (the
// `detected_identifier` the parse turned up). The query param is
// consumed once and cleared so a refresh doesn't re-open the modal.
export function BankAccountsPage() {
  const query = useBankAccountsQuery();
  const accounts = query.data ?? [];

  const queryClient = useQueryClient();
  const highlight = useRowHighlight<number>();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BankAccount | null>(null);
  const [registerSeed, setRegisterSeed] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Statement-upload deep-link: open the Add modal pre-filled with
  // the detected identifier. Done once per mount; the param is
  // consumed + cleared so navigating back doesn't reopen.
  useEffect(() => {
    const seed = searchParams.get('register');
    if (seed && !adding) {
      setRegisterSeed(seed);
      setAdding(true);
      const next = new URLSearchParams(searchParams);
      next.delete('register');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, adding]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: bankAccountKeys.all });
  }

  async function handleDelete(account: BankAccount) {
    await deleteBankAccountRequest(account.uid);
    setConfirmDelete(null);
    setEditing(null);
    invalidate();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Bank Accounts
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Register the bank accounts you use so statement uploads
            auto-attribute, and designate one as your tax-pot for the
            consumption-tax flow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRegisterSeed('');
            setAdding(true);
          }}
          className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
          data-testid="bank-account-add"
        >
          <Plus size={16} aria-hidden />
          Add account
        </button>
      </header>

      <TaxPotNudge />

      <Body
        loading={query.isLoading}
        accounts={accounts}
        highlightId={highlight.id}
        onOpenAccount={setEditing}
      />

      <BankAccountFormDialog
        open={adding}
        onClose={() => {
          setAdding(false);
          setRegisterSeed('');
        }}
        initialIdentifier={registerSeed}
        onSaved={(saved) => {
          invalidate();
          highlight.flash(saved.uid);
        }}
      />

      <BankAccountFormDialog
        open={editing != null}
        account={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          invalidate();
          highlight.flash(saved.uid);
        }}
        onRequestRemove={() => editing && setConfirmDelete(editing)}
      />

      <ConfirmDialog
        open={confirmDelete != null}
        title="Delete bank account?"
        message="This will permanently remove the account and its identifiers. Statement uploads that matched on these UPI handles will stop auto-attributing to this account."
        confirmLabel="Delete"
        intent="danger"
        onConfirm={() => {
          if (confirmDelete) void handleDelete(confirmDelete);
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function Body({
  loading,
  accounts,
  highlightId,
  onOpenAccount,
}: {
  loading: boolean;
  accounts: BankAccount[];
  highlightId: number | null;
  onOpenAccount: (account: BankAccount) => void;
}) {
  if (loading)
    return (
      <p className="text-sm text-slate-500" data-testid="bank-accounts-loading">
        Loading bank accounts…
      </p>
    );
  if (accounts.length === 0)
    return (
      <p
        className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
        data-testid="bank-accounts-empty"
      >
        No bank accounts yet. Add one to enable auto-attribution from statement
        uploads and to designate a tax-pot account.
      </p>
    );
  return (
    <ul className="flex flex-col gap-2" data-testid="bank-accounts-list">
      {accounts.map((a) => (
        <BankAccountRow
          key={a.uid}
          account={a}
          highlighted={highlightId === a.uid}
          onOpenDetail={() => onOpenAccount(a)}
        />
      ))}
    </ul>
  );
}
