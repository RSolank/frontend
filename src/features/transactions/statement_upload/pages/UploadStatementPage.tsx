import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  featureDisabledMessage,
  getFeatureDisabled,
} from '../../../../shared/api/capabilities';
import { useStatementUploadJobStore } from '../../../../shared/state/statementUploadJob.store';
import { prefetchOnIdle } from '../../../../shared/utils/prefetchOnIdle';
import { uploadStatementJobRequest } from '../api/mutations';
import { matchParserByFilename } from '../api/parserMatch';
import { useJobStatusQuery, useParserCatalogQuery } from '../api/queries';
import {
  extractNoParserDetail,
  HARDCODED_PARSER_CATALOG,
  isTerminalStatus,
  type JobStage,
  type JobStatus,
  type NoParserDetectedDetail,
  type ParserOption,
} from '../api/schemas';
import { ParserIcon } from '../components/ParserIcon';
import { ParserPickerModal } from '../components/ParserPickerModal';
import { StatementProgressRing } from '../components/StatementProgressRing';

interface ApiErrorShape {
  detail?: unknown;
  error?: string;
  status?: number;
}

interface PendingError {
  message: string;
  parserDetail: NoParserDetectedDetail | null;
}

// BE Phase 2.2 (`ac4ad00`) — async statement-upload page. The four-
// step synchronous pipeline (map-beneficiaries / categorize /
// finalize / per-row manual tag) was retired BE-side and replaced
// with a single `POST /statement-uploads -> 202 {job_id}` followed
// by a `GET /statement-uploads/{job_id}` poll until the job hits a
// terminal state.
//
// Parser-selector flow (BE handoff):
//   - User picks file → FE matches filename against the parser
//     catalog (`matchParserByFilename`).
//   - Match → a small parser pick row appears above the Upload
//     button + a quiet "Change parser" link opens the picker
//     modal.
//   - No match → an inline dropdown forces an explicit pick
//     before Upload is enabled.
//   - The chosen parser class is sent as `parser_override` so the
//     BE skips its own detection. BE may still fall back to
//     auto-detection if parsing with the chosen class fails (BE
//     remains source-of-truth for parser selection).
//
// Inline error envelopes:
//   - 409 — duplicate file_hash
//   - 422 — parser couldn't parse; renders a "Pick parser" button
//     that opens the modal pre-seeded with the user's last pick
//   - everything else — generic message with the BE detail string
export function UploadStatementPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState<PendingError | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overrideKey, setOverrideKey] = useState<string | null>(null);

  const activeJobId = useStatementUploadJobStore((s) => s.activeJobId);
  const setActiveJobId = useStatementUploadJobStore((s) => s.setActiveJobId);
  const reset = useStatementUploadJobStore((s) => s.reset);

  const jobQuery = useJobStatusQuery(activeJobId);
  const job = jobQuery.data ?? null;

  const catalogQuery = useParserCatalogQuery();
  const catalog = catalogQuery.data ?? HARDCODED_PARSER_CATALOG;

  const matchedParser = useMemo(
    () => (file ? matchParserByFilename(file.name, catalog) : null),
    [file, catalog]
  );
  const effectiveKey = overrideKey ?? matchedParser?.key ?? null;
  const effectiveParser = useMemo(
    () => catalog.find((p) => p.key === effectiveKey) ?? null,
    [catalog, effectiveKey]
  );

  // A fresh file selection invalidates the user override (the
  // previous pick was tied to the previous file).
  useEffect(() => {
    setOverrideKey(null);
  }, [file]);

  // Force-prefetch the global StatementUploadDock chunk as soon as
  // the user lands on the upload page — the TopNav idle schedule
  // also warms it, but a user who reaches /upload-statement within
  // the first ~5s of session start would otherwise pay the chunk
  // fetch on submit. Zero delay; idempotent module-level memo.
  useEffect(() => {
    return prefetchOnIdle(() => import('../components/StatementUploadDock'), 0);
  }, []);

  async function handleUpload() {
    if (!file) {
      setSubmitError({
        message: 'Choose a CSV or PDF file first.',
        parserDetail: null,
      });
      return;
    }
    setSubmitError(null);
    setUploading(true);
    try {
      const accepted = await uploadStatementJobRequest(file, effectiveKey);
      setActiveJobId(accepted.job_id);
      // Hand the user back to the dashboard so the import doesn't
      // pin them to this page; the global StatementUploadDock
      // (mounted in `app/App.tsx`) picks up the active id and
      // surfaces the progress ring + status copy bottom-right.
      // The dock auto-clears on COMPLETED and persists on FAILED so
      // the user can still come back here via "View" if needed.
      navigate('/dashboard');
    } catch (err) {
      setSubmitError(toPendingError(err));
    } finally {
      setUploading(false);
    }
  }

  function handleStartOver() {
    reset();
    setFile(null);
    setOverrideKey(null);
    setSubmitError(null);
  }

  function handlePickerConfirm(key: string) {
    setOverrideKey(key);
    setPickerOpen(false);
  }

  return (
    <div className="mx-auto my-6 max-w-3xl px-4 sm:my-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Upload statement
        </h1>
        <Link
          to="/transactions"
          className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 text-sm font-semibold"
        >
          ← Back to Transactions
        </Link>
      </header>

      {activeJobId === null && (
        <UploadCard
          file={file}
          onFileChange={setFile}
          onUpload={handleUpload}
          uploading={uploading}
          catalog={catalog}
          matchedParser={matchedParser}
          effectiveParser={effectiveParser}
          onChooseInline={setOverrideKey}
          onOpenPicker={() => setPickerOpen(true)}
        />
      )}

      {submitError && (
        <ErrorPanel
          error={submitError}
          onOpenPicker={() => setPickerOpen(true)}
        />
      )}

      {activeJobId !== null && (
        <JobStatusPanel
          isLoading={jobQuery.isLoading}
          isError={jobQuery.isError}
          job={job}
          onStartOver={handleStartOver}
          onViewTransactions={() => navigate('/transactions')}
        />
      )}

      <ParserPickerModal
        open={pickerOpen}
        parsers={catalog}
        initialKey={effectiveKey}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
      />
    </div>
  );
}

// 409 / 422 / network errors land here. 422 carries the BE parser
// catalog so the picker modal can pre-seed from the user's last
// pick.
function toPendingError(err: unknown): PendingError {
  // BE Phase 3.2 feature-disabled (403 with object detail) — check
  // FIRST so the deep-link / stale-tab path lands on a friendly
  // message instead of generic "Upload failed".
  const disabled = getFeatureDisabled(err);
  if (disabled) {
    return {
      message: featureDisabledMessage(disabled.feature),
      parserDetail: null,
    };
  }
  const e = err as ApiErrorShape;
  if (e.status === 409) {
    return {
      message:
        "We've already uploaded this exact file. If you intended a different statement, check the file and try again.",
      parserDetail: null,
    };
  }
  const parserDetail = extractNoParserDetail(e.detail);
  if (e.status === 422 && parserDetail) {
    return {
      message:
        "We couldn't parse this file with the chosen parser. Pick a different parser or adjust the source file and try again.",
      parserDetail,
    };
  }
  const fallback =
    typeof e.detail === 'string' ? e.detail : e.error || 'Upload failed';
  return { message: fallback, parserDetail: null };
}

interface UploadCardProps {
  file: File | null;
  onFileChange: (next: File | null) => void;
  onUpload: () => void;
  uploading: boolean;
  catalog: readonly ParserOption[];
  matchedParser: ParserOption | null;
  effectiveParser: ParserOption | null;
  onChooseInline: (key: string) => void;
  onOpenPicker: () => void;
}

function UploadCard({
  file,
  onFileChange,
  onUpload,
  uploading,
  catalog,
  matchedParser,
  effectiveParser,
  onChooseInline,
  onOpenPicker,
}: UploadCardProps) {
  const showInlineDropdown = file !== null && matchedParser === null;
  const showMatchCard = file !== null && effectiveParser !== null;
  const canUpload = !uploading && file !== null && effectiveParser !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="grid gap-3">
          <label className="form-label">
            Choose file (CSV/PDF)
            <input
              type="file"
              accept=".csv,.pdf"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              className="file:bg-accent-50 file:text-accent-700 hover:file:bg-accent-100 dark:file:bg-accent-950/40 dark:file:text-accent-300 dark:hover:file:bg-accent-950/60 mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold dark:text-slate-300"
              disabled={uploading}
              data-testid="statement-file-input"
            />
          </label>

          {showInlineDropdown && (
            <ParserDropdown
              catalog={catalog}
              value={effectiveParser?.key ?? null}
              onChange={onChooseInline}
              disabled={uploading}
            />
          )}

          <button
            type="button"
            onClick={onUpload}
            disabled={!canUpload}
            className="btn-primary inline-flex !w-auto items-center justify-center gap-1.5"
            data-testid="statement-upload-submit"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <Upload size={16} aria-hidden />
                Upload
              </>
            )}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Parsing happens in the background — you can navigate away and
            we&apos;ll keep you posted via the upload dock.
          </p>
        </div>
      </div>

      {showMatchCard && effectiveParser && (
        <MatchedParserCard
          parser={effectiveParser}
          onChangeParser={onOpenPicker}
        />
      )}
    </div>
  );
}

function ParserDropdown({
  catalog,
  value,
  onChange,
  disabled,
}: {
  catalog: readonly ParserOption[];
  value: string | null;
  onChange: (key: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="form-label" data-testid="parser-inline-picker">
      Parser
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        data-testid="parser-inline-select"
      >
        <option value="" disabled>
          Select a parser…
        </option>
        {catalog.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
        We couldn&apos;t guess this file&apos;s source from its name — pick the
        bank or service it came from.
      </span>
    </label>
  );
}

function MatchedParserCard({
  parser,
  onChangeParser,
}: {
  parser: ParserOption;
  onChangeParser: () => void;
}) {
  return (
    <div
      data-testid="statement-parser-match-card"
      className="border-accent-200 bg-accent-50 dark:border-accent-900/50 dark:bg-accent-950/40 flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3 text-sm"
    >
      <div className="flex items-center gap-3">
        <ParserIcon parserKey={parser.key} size={24} />
        <div className="flex flex-col">
          <span className="text-accent-900 dark:text-accent-200 font-semibold">
            Parser: {parser.label}
          </span>
          <span className="text-accent-700/80 dark:text-accent-300/80 font-mono text-xs">
            {parser.key}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onChangeParser}
        className="text-accent-700 hover:text-accent-900 focus-visible:ring-accent-500 dark:text-accent-300 dark:hover:text-accent-100 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
        data-testid="statement-parser-change"
      >
        Change parser
      </button>
    </div>
  );
}

function ErrorPanel({
  error,
  onOpenPicker,
}: {
  error: PendingError;
  onOpenPicker: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="statement-upload-error"
      className="border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900/60 dark:bg-danger-950/40 dark:text-danger-200 mt-4 rounded-md border px-4 py-3 text-sm"
    >
      <p>{error.message}</p>
      {error.parserDetail && (
        <button
          type="button"
          onClick={onOpenPicker}
          data-testid="statement-upload-pick-parser"
          className="bg-danger-600 hover:bg-danger-700 focus-visible:ring-danger-500 mt-2 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Pick parser
        </button>
      )}
    </div>
  );
}

interface JobStatusPanelProps {
  isLoading: boolean;
  isError: boolean;
  job: ReturnType<typeof useJobStatusQuery>['data'] | null;
  onStartOver: () => void;
  onViewTransactions: () => void;
}

function JobStatusPanel({
  isLoading,
  isError,
  job,
  onStartOver,
  onViewTransactions,
}: JobStatusPanelProps) {
  if (isError && !job)
    return (
      <PanelShell>
        <p
          className="text-danger-700 dark:text-danger-300 text-sm"
          data-testid="statement-job-error"
        >
          Couldn&apos;t fetch the job status. Try again in a moment.
        </p>
        <PanelFooter>
          <StartOverButton onClick={onStartOver} />
        </PanelFooter>
      </PanelShell>
    );

  if (isLoading || !job)
    return (
      <PanelShell>
        <PanelHeader status="PROCESSING" />
        <ProgressBody status="PROCESSING" stage="queued" />
      </PanelShell>
    );

  return (
    <PanelShell>
      <PanelHeader status={job.status} fileName={job.file_name} />
      {isTerminalStatus(job.status) ? (
        <TerminalBody
          job={job}
          onStartOver={onStartOver}
          onViewTransactions={onViewTransactions}
        />
      ) : (
        <ProgressBody status={job.status} stage={job.stage} />
      )}
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="statement-job-panel"
      className="mt-4 rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800"
    >
      {children}
    </div>
  );
}

function PanelFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
  );
}

function PanelHeader({
  status,
  fileName,
}: {
  status: JobStatus;
  fileName?: string | null;
}) {
  return (
    <header className="mb-3 flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <FileText size={18} aria-hidden className="text-accent-500" />
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {fileName ?? 'Uploading…'}
          </h2>
          <p
            data-testid="statement-job-status"
            className="text-xs tracking-wide text-slate-500 uppercase"
          >
            {STATUS_LABEL[status]}
          </p>
        </div>
      </div>
    </header>
  );
}

const STATUS_LABEL: Record<JobStatus, string> = {
  PROCESSING: 'Processing',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
};

function ProgressBody({
  status,
  stage,
}: {
  status: JobStatus;
  stage: JobStage | undefined;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <StatementProgressRing status={status} stage={stage} size={20} />
      <span>{progressCopy(stage)}</span>
    </div>
  );
}

function progressCopy(stage: JobStage | undefined): string {
  if (stage === 'queued') return 'Queued — picking it up now.';
  if (stage === 'parsing') return 'Parsing the file…';
  if (stage === 'attributing') return 'Attributing accounts…';
  if (stage === 'staging') return 'Staging transactions…';
  if (stage === 'mapping_beneficiaries') return 'Mapping payees…';
  if (stage === 'categorizing') return 'Categorizing transactions…';
  if (stage === 'computing_tax') return 'Computing tax…';
  return 'Working…';
}

function TerminalBody({
  job,
  onStartOver,
  onViewTransactions,
}: {
  job: NonNullable<ReturnType<typeof useJobStatusQuery>['data']>;
  onStartOver: () => void;
  onViewTransactions: () => void;
}) {
  if (job.status === 'COMPLETED')
    return (
      <>
        <div
          data-testid="statement-job-complete"
          className="border-success-200 bg-success-50 text-success-800 dark:border-success-900/50 dark:bg-success-950/40 dark:text-success-200 flex items-start gap-2 rounded-md border p-3 text-sm"
        >
          <CheckCircle2 size={18} aria-hidden className="mt-0.5" />
          <div>
            <p className="font-semibold">Upload complete.</p>
            <p>
              Parsed {job.txns_parsed} transaction
              {job.txns_parsed === 1 ? '' : 's'}; inserted {job.txns_inserted}.
            </p>
            {job.parser_used && (
              <p className="text-success-700/90 dark:text-success-300/80 mt-1 text-xs">
                Parser: <span className="font-mono">{job.parser_used}</span>
                {job.source_type ? ` · ${job.source_type}` : ''}
              </p>
            )}
          </div>
        </div>
        {job.suggest_register_account && (
          <RegisterAccountNotice identifier={job.detected_identifier} />
        )}
        <PanelFooter>
          <button
            type="button"
            onClick={onViewTransactions}
            className="btn-primary !w-auto"
            data-testid="statement-job-view-txns"
          >
            View transactions
          </button>
          <StartOverButton onClick={onStartOver} label="Upload another" />
        </PanelFooter>
      </>
    );

  // FAILED
  return (
    <>
      <div
        data-testid="statement-job-failed"
        className="border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900/60 dark:bg-danger-950/40 dark:text-danger-200 flex items-start gap-2 rounded-md border p-3 text-sm"
      >
        <AlertTriangle size={18} aria-hidden className="mt-0.5" />
        <div>
          <p className="font-semibold">Upload failed.</p>
          <p>
            {job.error_detail ??
              'Something went wrong while processing the file.'}
          </p>
        </div>
      </div>
      <PanelFooter>
        <StartOverButton onClick={onStartOver} label="Try again" />
      </PanelFooter>
    </>
  );
}

// Actionable notice rendered when the BE detected a source
// identifier (e.g. UPI handle in a PhonePe statement) but no
// registered bank account matched. Links to
// /settings/bank-accounts?register=<identifier> which deep-links
// into the Add modal pre-seeded with one pending UPI identifier
// (Batch 13 wiring). When the BE didn't surface a specific
// identifier the CTA still routes to the plain Add flow.
function RegisterAccountNotice({ identifier }: { identifier: string | null }) {
  const target = identifier
    ? `/settings/bank-accounts?register=${encodeURIComponent(identifier)}`
    : '/settings/bank-accounts';
  return (
    <div
      data-testid="statement-job-suggest-register-account"
      role="status"
      className="border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900/50 dark:bg-warning-950/40 dark:text-warning-200 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
    >
      <span>
        {identifier
          ? `We noticed this statement came from an account we don't recognise (${identifier}).`
          : "We noticed this statement came from an account we don't recognise."}
      </span>
      <Link
        to={target}
        data-testid="statement-job-register-account-cta"
        className="text-warning-900 dark:text-warning-100 font-semibold underline-offset-2 hover:underline"
      >
        Register this account →
      </Link>
    </div>
  );
}

function StartOverButton({
  onClick,
  label = 'Start over',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="statement-job-start-over"
      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {label}
    </button>
  );
}
