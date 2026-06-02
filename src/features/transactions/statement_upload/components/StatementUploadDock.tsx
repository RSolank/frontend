import { CheckCircle2, FileText, Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useStatementUploadJobStore } from '../../../../shared/state/statementUploadJob.store';
import { useJobStatusQuery } from '../api/queries';
import { isTerminalStatus, type JobStatus } from '../api/schemas';

// BE Phase 2.2 — global in-flight statement-upload dock. Lazy-
// mounted from the app shell so the user can navigate away from
// /upload-statement while a job is still parsing. Hides on the
// upload page itself (the page already renders the same status
// inline) and on COMPLETE auto-dismisses after a brief grace
// window so a successful upload doesn't linger. FAILED jobs stick
// until the user dismisses them explicitly so the error_detail
// stays visible.
const AUTO_DISMISS_COMPLETE_MS = 6_000;

export function StatementUploadDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeJobId = useStatementUploadJobStore((s) => s.activeJobId);
  const dismissed = useStatementUploadJobStore((s) => s.dismissed);
  const dismiss = useStatementUploadJobStore((s) => s.dismiss);
  const reset = useStatementUploadJobStore((s) => s.reset);

  const jobQuery = useJobStatusQuery(activeJobId);
  const job = jobQuery.data ?? null;
  const status = job?.status;

  // Auto-clear the active id when a COMPLETE job ages out. FAILED
  // jobs persist until the user dismisses them.
  useEffect(() => {
    if (status === 'COMPLETE') {
      const id = window.setTimeout(reset, AUTO_DISMISS_COMPLETE_MS);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [status, reset]);

  // The upload page surfaces the same panel inline — don't double
  // up. Hide whenever the user is already on /upload-statement.
  if (location.pathname === '/upload-statement') return null;
  if (activeJobId === null) return null;
  if (dismissed) return null;
  if (jobQuery.isError && !job) return null;
  if (jobQuery.isLoading || !job) return <DockShell><DockBody status="PENDING" /></DockShell>;

  return (
    <DockShell>
      <div className="flex items-center gap-2">
        <FileText size={16} aria-hidden className="text-accent-500" />
        <span className="max-w-[12rem] truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {job.file_name ?? 'Statement upload'}
        </span>
      </div>
      <DockBody
        status={job.status}
        errorDetail={job.error_detail}
        txnsInserted={job.txns_inserted}
      />
      {job.status === 'COMPLETE' && job.suggest_register_account && (
        <button
          type="button"
          onClick={() =>
            navigate(
              job.detected_identifier
                ? `/settings/bank-accounts?register=${encodeURIComponent(
                    job.detected_identifier
                  )}`
                : '/settings/bank-accounts'
            )
          }
          data-testid="statement-upload-dock-suggest-account"
          className="text-left text-xs font-semibold text-warning-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-warning-500 focus-visible:outline-none dark:text-warning-300"
        >
          Register this account →
        </button>
      )}
      <DockActions
        status={job.status}
        onView={() => navigate('/upload-statement')}
        onDismiss={isTerminalStatus(job.status) ? reset : dismiss}
      />
    </DockShell>
  );
}

function DockShell({ children }: { children: React.ReactNode }) {
  return (
    <aside
      data-testid="statement-upload-dock"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 flex w-72 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      {children}
    </aside>
  );
}

function DockBody({
  status,
  errorDetail,
  txnsInserted,
}: {
  status: JobStatus;
  errorDetail?: string | null;
  txnsInserted?: number;
}) {
  if (status === 'COMPLETE')
    return (
      <p className="flex items-center gap-1.5 text-xs text-success-700 dark:text-success-300">
        <CheckCircle2 size={14} aria-hidden />
        Inserted {txnsInserted ?? 0} transactions.
      </p>
    );
  if (status === 'FAILED')
    return (
      <p
        data-testid="statement-upload-dock-failed"
        className="text-xs text-danger-700 dark:text-danger-300"
      >
        Upload failed{errorDetail ? `: ${errorDetail}` : '.'}
      </p>
    );
  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <Loader2 size={12} className="animate-spin text-accent-500" aria-hidden />
      {bodyCopy(status)}
    </p>
  );
}

function bodyCopy(status: JobStatus): string {
  if (status === 'PENDING') return 'Queued…';
  if (status === 'PARSING') return 'Parsing…';
  if (status === 'CATEGORIZING') return 'Categorizing…';
  return 'Working…';
}

function DockActions({
  status,
  onView,
  onDismiss,
}: {
  status: JobStatus;
  onView: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-1 flex items-center justify-between">
      <button
        type="button"
        onClick={onView}
        className="text-xs font-medium text-accent-600 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none dark:text-accent-400 dark:hover:text-accent-300"
        data-testid="statement-upload-dock-open"
      >
        View
      </button>
      <button
        type="button"
        onClick={onDismiss}
        title={isTerminalStatus(status) ? 'Clear' : 'Hide'}
        aria-label={isTerminalStatus(status) ? 'Clear' : 'Hide'}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        data-testid="statement-upload-dock-dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
