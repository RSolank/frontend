import { Link } from 'react-router-dom';

// Zone ❸ when taxation is off — the demoted provision/savings story. The
// engine is disabled, so there's no live accrual or set-aside to show; this is
// a calm, dataless re-enable nudge that holds the savings narrative's place
// without faking numbers. (Its counterpart, the spend analytics, has been
// promoted to the hero — see DashboardHero's off branch.)
export function ProvisionSavingsPlaceholder() {
  return (
    <section
      data-testid="dashboard-savings-placeholder"
      aria-labelledby="dashboard-savings-placeholder-heading"
      className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg dark:bg-emerald-950/50">
        🌱
      </div>
      <div>
        <h2
          id="dashboard-savings-placeholder-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Savings is turned off
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slate-500 dark:text-slate-400">
          Aevum is running as a plain expense tracker. Turn the consumption tax
          back on to start setting money aside each week and grow a savings
          balance toward your future self.
        </p>
      </div>
      <Link
        to="/account/preferences?highlight=tax-mode"
        className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
        data-testid="dashboard-savings-placeholder-cta"
      >
        Enable savings →
      </Link>
    </section>
  );
}
