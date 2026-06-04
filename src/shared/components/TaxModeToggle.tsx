import { useTaxModeStore } from '../state/taxMode.store';

// BE Phase 2.6 (Decision 26) — surface the `auto_enabled` taxation
// preference. Reads + writes via the Zustand store; the
// `subscribeToPreferenceStores()` subscriber in
// `features/users/api/preferences.ts` PATCHes the change back to
// `/api/users/preferences.auto_enabled` (fire-and-forget).
export function TaxModeToggle() {
  const enabled = useTaxModeStore((s) => s.enabled);
  const toggle = useTaxModeStore((s) => s.toggle);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
          Auto-finalize weekly bills
        </span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {enabled
            ? 'The Monday worker finalizes each completed week into a bill.'
            : 'Bills stay in Accruing — generate them manually from the Tax Tracker.'}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Auto-finalize weekly bills"
        onClick={toggle}
        data-testid="tax-mode-toggle"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900 ${
          enabled
            ? 'bg-accent-600 dark:bg-accent-500'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
