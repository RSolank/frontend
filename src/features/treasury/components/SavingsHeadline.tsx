import { CountUpNumber } from '../../../shared/components/CountUpNumber';

type Money = (n: number | null | undefined) => string;

// Zone 1 — the headline. The hero number is "Set aside" (the funded
// balance: all cash the committee has actually banked). Beside it sit the
// two framing stats: how much the user *owes their future self* (the levied
// provision) and the coverage ratio between them. Pure / presentational —
// the page feeds the derived numbers + a `money` formatter so a future
// dashboard hero can mount this with its own data.
export function SavingsHeadline({
  fundedBalance,
  provisionedTotal,
  money,
}: {
  fundedBalance: number;
  provisionedTotal: number;
  money: Money;
}) {
  // Coverage is only meaningful once something has been provisioned; with a
  // zero provision the ratio is undefined (not 0% or ∞), so we suppress it.
  const coveragePct =
    provisionedTotal > 0
      ? Math.round((fundedBalance / provisionedTotal) * 100)
      : null;

  return (
    <section
      aria-labelledby="savings-headline-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 id="savings-headline-heading" className="sr-only">
        Savings summary
      </h2>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Set aside
          </div>
          <div
            className="mt-1 text-4xl font-semibold text-emerald-600 dark:text-emerald-400"
            data-testid="savings-funded-balance"
          >
            <CountUpNumber value={fundedBalance} format={money} />
          </div>
        </div>

        {/* `items-end` + per-column `justify-end` bottom-align the two values, so
            they stay level even when a longer label ("Owed to your future self")
            wraps to two lines in a narrow card while "Coverage" stays on one. */}
        <dl className="flex items-end gap-6">
          <div className="flex flex-col justify-end">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Owed to your future self
            </dt>
            <dd
              className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100"
              data-testid="savings-provisioned-total"
            >
              <CountUpNumber value={provisionedTotal} format={money} />
            </dd>
          </div>
          <div className="flex flex-col justify-end">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Coverage
            </dt>
            <dd
              className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100"
              data-testid="savings-coverage"
            >
              {coveragePct == null ? (
                '—'
              ) : (
                <CountUpNumber value={coveragePct} format={(n) => `${n}%`} />
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
