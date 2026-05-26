import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { precedingWeekStartInTz, weekRangeInTz } from '../api/billPeriod';
import { generateBillsRequest } from '../api/mutations';

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
  // guard and to derive Sun→Sat boundaries from a single picked date.
  timezone: string;
}

export function GenerateBillsDialog({
  open,
  onClose,
  onGenerated,
  timezone,
}: GenerateBillsDialogProps) {
  const [mode, setMode] = useState<GenerateMode>('week');
  const [weekPickDate, setWeekPickDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Reset on each open.
  useEffect(() => {
    if (!open) return;
    setMode('week');
    setWeekPickDate('');
    setRangeStart('');
    setRangeEnd('');
    setError(null);
    setGenerating(false);
  }, [open]);

  const precedingWeekStart = useMemo(
    () => precedingWeekStartInTz(timezone),
    [timezone]
  );

  function resolvePeriod():
    | { ok: true; period_start: string; period_end: string }
    | { ok: false; reason: string } {
    if (mode === 'week') {
      if (!weekPickDate) {
        return { ok: false, reason: 'Pick a week date first.' };
      }
      // The date input is `YYYY-MM-DD`; parse at noon UTC so tz-edge
      // surprises don't shift the resolved Sun–Sat range.
      const parsed = new Date(`${weekPickDate}T12:00:00Z`);
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
    return { ok: true, period_start: rangeStart, period_end: rangeEnd };
  }

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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Pick any date inside the target week
            </span>
            <input
              type="date"
              value={weekPickDate}
              onChange={(e) => setWeekPickDate(e.target.value)}
              className="form-input"
              data-testid="generate-week-input"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Week boundaries are Sunday through Saturday in your active
              timezone ({timezone}). Date format defaults to the browser
              locale; the Account Preferences page will let you override
              this in a later batch.
            </span>
          </label>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Period start
              </span>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="form-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Period end
              </span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="form-input"
              />
            </label>
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
