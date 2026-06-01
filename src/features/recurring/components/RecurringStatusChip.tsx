import type { RecurringStatus } from '../api/schemas';

// User-facing labels for the BE 3-state status machine (inference-
// engine framing). `candidate` (worker-detected, never confirmed) +
// `review` (anomaly streak — engine wants user attention) stay
// visible as distinct chips per the UX call locked at Batch 11
// kick-off; raw values stay off the UI surface.
interface ChipSpec {
  label: string;
  classes: string;
  // Tooltip — surfaces the raw status semantic for power users.
  title: string;
}

const SPEC: Record<RecurringStatus, ChipSpec> = {
  candidate: {
    label: 'Detected',
    classes:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    title: 'Detected by the engine — confirm to lock it in.',
  },
  review: {
    label: 'Needs attention',
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/50',
    title: 'Recent occurrences drifted — review and acknowledge.',
  },
  locked: {
    label: 'Confirmed',
    classes:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/50',
    title: 'Confirmed — forecasts run on every cycle.',
  },
};

export function RecurringStatusChip({ status }: { status: RecurringStatus }) {
  const spec = SPEC[status];
  return (
    <span
      title={spec.title}
      data-testid={`recurring-status-${status}`}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${spec.classes}`}
    >
      {spec.label}
    </span>
  );
}
