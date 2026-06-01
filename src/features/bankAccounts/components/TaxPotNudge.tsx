import { Info, X } from 'lucide-react';

import { useBankAccountsQuery } from '../api/queries';
import { useTaxPotNudgeStore } from '../state/taxPotNudge.store';

// Dismissible nudge surfaced on the Bank Accounts page when the
// user hasn't designated a tax-pot account. Hides itself once
// the user has at least one committee account, or once they
// explicitly dismiss. Dismiss state persists via Zustand +
// `persist` (`pba.tax-pot-nudge`).
export function TaxPotNudge() {
  const dismissed = useTaxPotNudgeStore((s) => s.dismissed);
  const dismiss = useTaxPotNudgeStore((s) => s.dismiss);
  const query = useBankAccountsQuery();

  // Don't render while loading — the nudge appearing then
  // disappearing once the list resolves is visual noise.
  if (query.isLoading || query.isError) return null;
  if (dismissed) return null;
  const accounts = query.data ?? [];
  if (accounts.some((a) => a.is_committee_account)) return null;

  return (
    <section
      role="status"
      data-testid="tax-pot-nudge-banner"
      className="mb-4 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-start gap-2">
        <Info size={18} aria-hidden className="mt-0.5" />
        <div>
          <p className="font-semibold">Designate a tax-pot account</p>
          <p className="mt-1">
            Mark one of your accounts as the tax-pot. Self-transfers to
            its identifiers will auto-acquire the consumption-tax-paid
            tag, so the tracker reconciles without manual tagging.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss nudge"
        title="Dismiss"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none dark:text-amber-300 dark:hover:bg-amber-950/60 dark:hover:text-amber-100"
        data-testid="tax-pot-nudge-dismiss"
      >
        <X size={14} />
      </button>
    </section>
  );
}
