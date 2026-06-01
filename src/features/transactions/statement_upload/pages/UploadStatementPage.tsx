import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useStatementUploadJobStore } from '../../../../shared/state/statementUploadJob.store';
import { uploadStatementJobRequest } from '../api/mutations';
import { matchParserByFilename } from '../api/parserMatch';
import { useJobStatusQuery, useParserCatalogQuery } from '../api/queries';
import {
  extractNoParserDetail,
  HARDCODED_PARSER_CATALOG,
  isTerminalStatus,
  type JobStatus,
  type NoParserDetectedDetail,
  type ParserOption,
} from '../api/schemas';
import { ParserPickerModal } from '../components/ParserPickerModal';

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

  async function handleUpload() {
    if (!file) {
      setSubmitError({ message: 'Choose a CSV or PDF file first.', parserDetail: null });
      return;
    }
    setSubmitError(null);
    setUploading(true);
    try {
      const accepted = await uploadStatementJobRequest(file, effectiveKey);
      setActiveJobId(accepted.job_id);
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
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
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
              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-950/40 dark:file:text-indigo-300 dark:hover:file:bg-indigo-950/60"
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
            className="btn-primary !w-auto inline-flex items-center justify-center gap-1.5"
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
            Parsing happens in the background — you can navigate away
            and we&apos;ll keep you posted via the upload dock.
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
        We couldn&apos;t guess this file&apos;s source from its name —
        pick the bank or service it came from.
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
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/40"
    >
      <div className="flex flex-col">
        <span className="font-semibold text-indigo-900 dark:text-indigo-200">
          Parser: {parser.label}
        </span>
        <span className="font-mono text-xs text-indigo-700/80 dark:text-indigo-300/80">
          {parser.key}
        </span>
      </div>
      <button
        type="button"
        onClick={onChangeParser}
        className="text-xs font-semibold text-indigo-700 transition-colors hover:text-indigo-900 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-indigo-300 dark:hover:text-indigo-100"
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
      className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <p>{error.message}</p>
      {error.parserDetail && (
        <button
          type="button"
          onClick={onOpenPicker}
          data-testid="statement-upload-pick-parser"
          className="mt-2 inline-flex items-center justify-center rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
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
          className="text-sm text-rose-700 dark:text-rose-300"
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
        <PanelHeader status="PENDING" />
        <ProgressBody status="PENDING" />
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
        <ProgressBody status={job.status} />
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
        <FileText size={18} aria-hidden className="text-indigo-500" />
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {fileName ?? 'Uploading…'}
          </h2>
          <p
            data-testid="statement-job-status"
            className="text-xs uppercase tracking-wide text-slate-500"
          >
            {STATUS_LABEL[status]}
          </p>
        </div>
      </div>
    </header>
  );
}

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: 'Queued',
  PARSING: 'Parsing',
  CATEGORIZING: 'Categorizing',
  COMPLETE: 'Complete',
  FAILED: 'Failed',
};

function ProgressBody({ status }: { status: JobStatus }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <Loader2 size={16} className="animate-spin text-indigo-500" aria-hidden />
      <span>{progressCopy(status)}</span>
    </div>
  );
}

function progressCopy(status: JobStatus): string {
  if (status === 'PENDING') return 'Queued — picking it up now.';
  if (status === 'PARSING') return 'Parsing the file…';
  if (status === 'CATEGORIZING') return 'Categorizing transactions…';
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
  if (job.status === 'COMPLETE')
    return (
      <>
        <div
          data-testid="statement-job-complete"
          className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 size={18} aria-hidden className="mt-0.5" />
          <div>
            <p className="font-semibold">Upload complete.</p>
            <p>
              Parsed {job.txns_parsed} transaction
              {job.txns_parsed === 1 ? '' : 's'}; inserted{' '}
              {job.txns_inserted}.
            </p>
            {job.parser_used && (
              <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/80">
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
        className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
      >
        <AlertTriangle size={18} aria-hidden className="mt-0.5" />
        <div>
          <p className="font-semibold">Upload failed.</p>
          <p>{job.error_detail ?? 'Something went wrong while processing the file.'}</p>
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
function RegisterAccountNotice({
  identifier,
}: {
  identifier: string | null;
}) {
  const target = identifier
    ? `/settings/bank-accounts?register=${encodeURIComponent(identifier)}`
    : '/settings/bank-accounts';
  return (
    <div
      data-testid="statement-job-suggest-register-account"
      role="status"
      className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span>
        {identifier
          ? `We noticed this statement came from an account we don't recognise (${identifier}).`
          : "We noticed this statement came from an account we don't recognise."}
      </span>
      <Link
        to={target}
        data-testid="statement-job-register-account-cta"
        className="font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
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
