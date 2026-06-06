import type { JobStage, JobStatus } from '../api/schemas';

// Pipeline stages in order, matching `app/constants/statement_uploads.py`
// → `STATEMENT_PIPELINE_STAGES`. The ring fills as the BE-supplied
// `stage` advances; `done` is index 7 → ring full. On COMPLETED we
// always show a full ring (even if the BE didn't write `done`); on
// FAILED the ring freezes at whichever stage raised.
const STAGES: readonly JobStage[] = [
  'queued',
  'parsing',
  'attributing',
  'staging',
  'mapping_beneficiaries',
  'categorizing',
  'computing_tax',
  'done',
];

const TOTAL_STAGES = STAGES.length;

function fillToneClass(status: JobStatus): string {
  if (status === 'COMPLETED') return 'text-success-500 dark:text-success-400';
  if (status === 'FAILED') return 'text-danger-500 dark:text-danger-400';
  return 'text-accent-500 dark:text-accent-400';
}

function stageProgress(status: JobStatus, stage: JobStage | undefined): number {
  if (status === 'COMPLETED') return 1;
  if (status === 'FAILED') {
    // Show the partial fill up to where it died so the failure has
    // visual context.
    if (!stage) return 0;
    const idx = STAGES.indexOf(stage);
    return idx < 0 ? 0 : idx / (TOTAL_STAGES - 1);
  }
  if (!stage) return 0;
  const idx = STAGES.indexOf(stage);
  if (idx < 0) return 0;
  // Stages 0..7 — clamp at 87.5% while non-terminal so the ring never
  // looks fully complete until the BE actually flips status.
  return Math.min(idx / (TOTAL_STAGES - 1), (TOTAL_STAGES - 1) / TOTAL_STAGES);
}

interface StatementProgressRingProps {
  status: JobStatus;
  stage: JobStage | undefined;
  size?: number;
}

// Circular determinate progress for the statement-upload pipeline.
// Wraps a stroked SVG ring whose `stroke-dashoffset` ticks down as
// the BE's `stage` advances. Tone matches dock states: accent on
// PROCESSING, success on COMPLETED, danger on FAILED.
export function StatementProgressRing({
  status,
  stage,
  size = 20,
}: StatementProgressRingProps) {
  const progress = stageProgress(status, stage);
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  const trackClass = 'text-slate-200 dark:text-slate-700';
  const fillClass = fillToneClass(status);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Upload ${Math.round(progress * 100)}% complete`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className={trackClass}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={`${fillClass} transition-[stroke-dashoffset] duration-500`}
      />
    </svg>
  );
}
