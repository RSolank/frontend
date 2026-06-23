import { useTaxModeStore, type TaxMode } from '../state/taxMode.store';

// Surface the 3-state `tax_mode` taxation preference (T-treasury). Reads +
// writes via the Zustand store; the `subscribeToPreferenceStores()` subscriber
// in `features/users/api/preferences.ts` PATCHes the change back to
// `/api/users/preferences.tax_mode` (fire-and-forget).
const OPTIONS: { value: TaxMode; label: string; help: string }[] = [
  {
    value: 'off',
    label: 'Off',
    help: 'Expense tracker only — no self-tax bills are accrued.',
  },
  {
    value: 'manual',
    label: 'Manual',
    help: 'Bills accrue, but you finalize them yourself from the Tax Tracker.',
  },
  {
    value: 'auto',
    label: 'Auto',
    help: 'The Monday worker finalizes each completed week into a bill.',
  },
];

export function TaxModeToggle() {
  const mode = useTaxModeStore((s) => s.mode);
  const setMode = useTaxModeStore((s) => s.setMode);
  const active = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[2]!;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
          Taxation mode
        </span>
        <div
          role="radiogroup"
          aria-label="Taxation mode"
          data-testid="tax-mode-toggle"
          className="inline-flex shrink-0 rounded-md border border-slate-300 p-0.5 dark:border-slate-700"
        >
          {OPTIONS.map((o) => {
            const selected = o.value === mode;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`tax-mode-${o.value}`}
                onClick={() => setMode(o.value)}
                className={`focus-visible:ring-accent-500 rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  selected
                    ? 'bg-accent-600 text-white dark:bg-accent-500'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
        {active.help}
      </span>
    </div>
  );
}
