import { DangerZone } from '../components/DangerZone';
import { DataExportPanel } from '../components/DataExportPanel';

// Card-anchored layout (Batch 9 polish): breadcrumb reads
// "Account › Privacy"; no in-content title.
export function AccountPrivacyPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Privacy controls
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The privacy mask under{' '}
          <a
            href="/account/accessibility"
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Accessibility
          </a>{' '}
          blurs every rendered amount across the app.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Export data
        </h2>
        <DataExportPanel />
      </div>

      <DangerZone />
    </div>
  );
}
