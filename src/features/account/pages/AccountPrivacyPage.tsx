export function AccountPrivacyPage() {
  // Card-anchored layout (Batch 9 polish): breadcrumb reads
  // "Account › Privacy"; no in-content title.
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Coming soon
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Export your transactions and account data.</li>
          <li>Delete your account and clear server-side history.</li>
          <li>Configure data-retention windows.</li>
        </ul>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          These need backend endpoints that haven&rsquo;t shipped yet.
          For an in-app privacy control today, see the privacy mask under{' '}
          <a
            href="/account/accessibility"
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Accessibility
          </a>{' '}
          — it blurs every rendered amount across the app.
        </p>
      </div>
    </div>
  );
}
