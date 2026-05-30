import { useEffect, useMemo, useState } from 'react';

import { DateField } from '../../../shared/components/DateField';
import { Modal } from '../../../shared/components/Modal';
import {
  formatBillDate,
  precedingWeekStartInTz,
  weekRangeInTz,
} from '../api/billPeriod';
import { generateBillsRequest } from '../api/mutations';

import { WeekPickerCalendar } from './WeekPickerCalendar';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

type GenerateMode = 'week' | 'range';

interface GenerateBillsDialogProps {
  open: boolean;
  onClose: () => void;
  // Called with the generated bill IDs (may be empty if the range
  // produced no new bills). The parent flashes the first id and
  // invalidates its bills query.
  onGenerated: (billIds: number[]) => void | Promise<void>;
  // Active user timezone — needed to compute the preceding-week
  // guard and to derive ISO Mon→Sun boundaries from a single picked
  // date. NOTE: the backend still iterates Sun-Sat internally; the
  // request range produced here may not align with stored bill
  // boundaries until the backend convention cutover lands (see
  // `.scratch/task-handoff-fe-to-be.md §12`).
  timezone: string;
}

// View-model: owns the mode/week/range state, the reset-on-open effect,
// the ISO Mon→Sun period resolution (live preview + submit), and the
// generate mutation. Keeps the dialog component a thin render under the
// max-lines gate.
function useGenerateBills({
  open,
  onClose,
  onGenerated,
  timezone,
}: GenerateBillsDialogProps) {
  const [mode, setMode] = useState<GenerateMode>('week');
  // ISO Mon (period_start) of the picked week, set by the
  // WeekPickerCalendar. Null until the user clicks a row.
  const [pickedWeekStart, setPickedWeekStart] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Reset on each open.
  useEffect(() => {
    if (!open) return;
    setMode('week');
    setPickedWeekStart(null);
    setRangeStart('');
    setRangeEnd('');
    setError(null);
    setGenerating(false);
  }, [open]);

  const precedingWeekStart = useMemo(
    () => precedingWeekStartInTz(timezone),
    [timezone]
  );

  // ISO Mon→Sun snap for the date-range mode. Picks the range that
  // contains both user-picked endpoints: start → preceding Monday of
  // `rangeStart`, end → following Sunday of `rangeEnd`. Keeps the
  // generation aligned with the project ISO 8601 week convention
  // (see CONTRIBUTING.md §6 + [[iso-week-convention]] memory) so the
  // request never straddles partial weeks. The week-picker branch is
  // intrinsically ISO already because it goes through weekRangeInTz.
  function resolvePeriod():
    | { ok: true; period_start: string; period_end: string }
    | { ok: false; reason: string } {
    if (mode === 'week') {
      if (!pickedWeekStart) {
        return { ok: false, reason: 'Pick a week first.' };
      }
      // pickedWeekStart is already the ISO Monday — resolve through
      // weekRangeInTz to derive the matching Sunday end, which keeps
      // a single source of truth for the Mon → Sun span.
      const parsed = new Date(`${pickedWeekStart}T12:00:00Z`);
      const range = weekRangeInTz(parsed, timezone);
      return { ok: true, ...range };
    }
    if (!rangeStart || !rangeEnd) {
      return { ok: false, reason: 'Choose period_start and period_end.' };
    }
    if (rangeStart > rangeEnd) {
      return {
        ok: false,
        reason: 'period_start must be on or before period_end.',
      };
    }
    const startSnap = weekRangeInTz(
      new Date(`${rangeStart}T12:00:00Z`),
      timezone
    );
    const endSnap = weekRangeInTz(
      new Date(`${rangeEnd}T12:00:00Z`),
      timezone
    );
    return {
      ok: true,
      period_start: startSnap.period_start,
      period_end: endSnap.period_end,
    };
  }

  // Same resolution logic but produces a non-throwing preview the
  // user can see live as they pick dates. Renders below the inputs.
  const resolvedPreview = useMemo(() => {
    const r = resolvePeriod();
    return r.ok ? r : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pickedWeekStart, rangeStart, rangeEnd, timezone]);

  async function handleGenerate() {
    setError(null);
    const resolved = resolvePeriod();
    if (!resolved.ok) {
      setError(resolved.reason);
      return;
    }
    if (resolved.period_end >= precedingWeekStart) {
      setError(
        `Can only generate for periods ending before ${precedingWeekStart} (the preceding week).`
      );
      return;
    }
    setGenerating(true);
    try {
      const res = await generateBillsRequest({
        period_start: resolved.period_start,
        period_end: resolved.period_end,
      });
      await onGenerated(res.bill_ids ?? []);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate bills'));
    } finally {
      setGenerating(false);
    }
  }

  return {
    mode,
    setMode,
    pickedWeekStart,
    setPickedWeekStart,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    error,
    generating,
    precedingWeekStart,
    resolvedPreview,
    handleGenerate,
  };
}

export function GenerateBillsDialog({
  open,
  onClose,
  onGenerated,
  timezone,
}: GenerateBillsDialogProps) {
  const {
    mode,
    setMode,
    pickedWeekStart,
    setPickedWeekStart,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    error,
    generating,
    precedingWeekStart,
    resolvedPreview,
    handleGenerate,
  } = useGenerateBills({ open, onClose, onGenerated, timezone });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate bills"
      description={`Only weeks ending before ${precedingWeekStart} are billable.`}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="btn-primary !w-auto"
          >
            {generating ? 'Generating…' : 'Generate / refresh'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
          <legend className="sr-only">Pick a generation mode</legend>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="generate-mode"
              checked={mode === 'week'}
              onChange={() => setMode('week')}
              className="h-4 w-4 accent-indigo-600 dark:accent-indigo-400"
            />
            <span className="font-medium">Week picker</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="generate-mode"
              checked={mode === 'range'}
              onChange={() => setMode('range')}
              className="h-4 w-4 accent-indigo-600 dark:accent-indigo-400"
            />
            <span className="font-medium">Date range</span>
          </label>
        </fieldset>

        {mode === 'week' ? (
          <div className="flex flex-col gap-2 text-sm" data-testid="generate-week-input">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Pick a week
            </span>
            <WeekPickerCalendar
              selectedWeekStart={pickedWeekStart}
              onSelect={setPickedWeekStart}
              timezone={timezone}
              precedingWeekStart={precedingWeekStart}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Period start
              </span>
              <DateField
                value={rangeStart}
                onChange={setRangeStart}
                ariaLabel="Period start"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Period end
              </span>
              <DateField
                value={rangeEnd}
                onChange={setRangeEnd}
                ariaLabel="Period end"
              />
            </label>
          </div>
        )}

        {resolvedPreview && (
          <div
            data-testid="generate-resolved-preview"
            className="rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200"
          >
            <span className="font-medium">
              Resolves to ISO week
              {resolvedPreview.period_start !== resolvedPreview.period_end &&
              mode === 'range'
                ? 's'
                : ''}
              :
            </span>{' '}
            <span className="tabular-nums">
              {formatBillDate(resolvedPreview.period_start, timezone)} →{' '}
              {formatBillDate(resolvedPreview.period_end, timezone)}
            </span>
            {mode === 'range' && (
              <p className="mt-0.5 text-xs text-indigo-700/80 dark:text-indigo-300/80">
                Endpoints are snapped to ISO Mon → Sun boundaries so the
                request covers whole weeks only.
              </p>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
