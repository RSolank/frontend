import { Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { Modal } from '../../../shared/components/Modal';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import {
  deleteBudgetLimitRequest,
  upsertBudgetLimitRequest,
} from '../api/mutations';
import type { BudgetCategory } from '../api/queries';
import { formatRateForInput, parseRateInput } from '../api/rateInput';
import { budgetFormSchema } from '../api/schemas';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

// Defer-update window for typed values that fall OUTSIDE the observed
// range — gives the user a beat to finish typing a multi-digit number
// before the slider's bounds jump. In-range values commit live.
const CUSTOM_DEBOUNCE_MS = 1000;

interface BudgetFormDialogProps {
  open: boolean;
  onClose: () => void;
  category: BudgetCategory | null;
  onSaved: (savedTagId: number) => void | Promise<void>;
}

// Heuristic step size based on the size of the observed range. Sliders
// stutter at 1-unit step when the user has thousands of dollars of
// monthly spend; using a larger step at higher ranges makes the bubble
// numbers feel more usable AND lands the thumb on round-ish values.
function sliderStepFor(min: number, max: number): number {
  const span = Math.max(0, max - min);
  if (span <= 100) return 1;
  if (span <= 1000) return 5;
  if (span <= 10_000) return 50;
  return 100;
}

function snapToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

// Modal heading by mode — if/else (not a nested ternary) so it stays off
// sonarjs/no-nested-conditional.
function dialogTitle(category: BudgetCategory | null, isExisting: boolean): string {
  if (!category) return 'Budget';
  if (isExisting) return `Edit budget — ${category.tag_name}`;
  return `Set budget — ${category.tag_name}`;
}

// Save-button label by state — if/else for the same reason as dialogTitle.
function saveButtonLabel(saving: boolean, isExisting: boolean): string {
  if (saving) return 'Saving…';
  return isExisting ? 'Save changes' : 'Set budget';
}

// The mutation half of the form: save + remove, plus the four pieces of
// request-status state they own (error / saving / confirm / removing).
// Composed into useBudgetForm; split out only to keep that hook under the
// line-count gate. `value` / `penalty` arrive from the parent hook so the
// handlers read the current committed values.
function useBudgetMutations(
  category: BudgetCategory | null,
  value: number,
  penalty: string,
  onSaved: (savedTagId: number) => void | Promise<void>,
  onClose: () => void
) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleSave() {
    if (!category) return;
    setError(null);
    const parsedPenalty = parseRateInput(penalty);
    const parsed = budgetFormSchema.safeParse({
      tag_id: category.tag_id,
      budget_period: 'monthly',
      limit_amt: value,
      penalty_rate: parsedPenalty,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setSaving(true);
    try {
      await upsertBudgetLimitRequest(parsed.data);
      await onSaved(category.tag_id);
      // Row-highlight on the parent communicates success; close
      // cleanly in both Edit + Set-budget paths.
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save budget'));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemove() {
    if (!category) return;
    setError(null);
    setRemoving(true);
    try {
      await deleteBudgetLimitRequest(category.tag_id);
      await onSaved(category.tag_id);
      setConfirmRemoveOpen(false);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove budget'));
      setConfirmRemoveOpen(false);
    } finally {
      setRemoving(false);
    }
  }

  return {
    error,
    setError,
    saving,
    setSaving,
    confirmRemoveOpen,
    setConfirmRemoveOpen,
    removing,
    setRemoving,
    handleSave,
    handleConfirmRemove,
  };
}

// All of the dialog's state, effects, derived values and handlers. Pulled
// out of the component so the render stays a thin presentational shell under
// the complexity / line-count gates. Behaviour is identical to the previous
// inline implementation — this is a verbatim relocation.
function useBudgetForm(
  category: BudgetCategory | null,
  open: boolean,
  onSaved: (savedTagId: number) => void | Promise<void>,
  onClose: () => void
) {
  const isExisting = category != null && category.limit_amt != null;

  const baseMin = Math.max(0, category?.min_net_expense ?? 0);
  const baseMax = Math.max(baseMin, category?.max_net_expense ?? 0);
  const baseAvg = Math.max(0, category?.avg_net_expense ?? 0);

  function initialValue(c: BudgetCategory | null): number {
    if (!c) return 0;
    if (c.limit_amt != null) return c.limit_amt;
    if (baseAvg > 0) return Math.round(baseAvg);
    return Math.round((baseMin + baseMax) / 2);
  }

  // Single source of truth — `value` is the numeric limit; `draft` is
  // the textbox's transient content. Slider, ± buttons, and field
  // all read+write `value`. Slider auto-expands its effective range
  // to include any typed value, so a user can land on $5,000 even if
  // the observed max is $400.
  const [value, setValue] = useState<number>(initialValue(category));
  const [draft, setDraft] = useState<string>(() =>
    String(initialValue(category))
  );
  const [penalty, setPenalty] = useState<string>(() => {
    if (!category) return '5%';
    const rate = category.penalty_rate ?? category.default_penalty_rate ?? 0.05;
    return formatRateForInput(rate);
  });
  const mutations = useBudgetMutations(
    category,
    value,
    penalty,
    onSaved,
    onClose
  );
  const debounceRef = useRef<number | null>(null);
  // Snapshot of the values the open-effect wrote — used by isDirty
  // instead of comparing against `category.limit_amt` directly.
  // Reason: ExpenseTrackerPage keeps BudgetFormDialog mounted across
  // open/close cycles, so on a fresh open the render BEFORE the
  // open-effect sees value=0 (the useState initial when category was
  // null) vs category.limit_amt=350 and briefly reports dirty=true
  // for one render cycle. The snapshot stays null until the effect
  // runs, so isDirty returns false during that gap.
  const initialSnapshotRef = useRef<{
    value: number;
    penalty: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !category) {
      // Clearing the snapshot on close keeps the next open fresh.
      initialSnapshotRef.current = null;
      return;
    }
    const v = initialValue(category);
    setValue(v);
    setDraft(String(v));
    const rate = category.penalty_rate ?? category.default_penalty_rate ?? 0.05;
    const p = formatRateForInput(rate);
    setPenalty(p);
    initialSnapshotRef.current = { value: v, penalty: p };
    mutations.setError(null);
    mutations.setSaving(false);
    mutations.setConfirmRemoveOpen(false);
    mutations.setRemoving(false);
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  useEffect(
    () => () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
      }
    },
    []
  );

  // Slider bounds — always auto-expand to include `value` and any
  // numeric in `draft`. No frozen mode; the field is the precise
  // entry path and the slider visualises wherever the user lands.
  const effectiveBounds = useMemo<{ lo: number; hi: number }>(() => {
    const candidates: number[] = [baseMin, baseMax, value];
    const draftNum = Number(draft);
    if (Number.isFinite(draftNum) && draft.trim() !== '') {
      candidates.push(draftNum);
    }
    const lo = Math.min(...candidates, 0);
    const hi = Math.max(...candidates, lo + 1);
    return { lo, hi };
  }, [baseMin, baseMax, value, draft]);

  const step = sliderStepFor(effectiveBounds.lo, effectiveBounds.hi);

  const bubblePercent = useMemo<number>(() => {
    const span = effectiveBounds.hi - effectiveBounds.lo;
    if (span <= 0) return 0;
    const clamped = Math.min(
      Math.max(value, effectiveBounds.lo),
      effectiveBounds.hi
    );
    return ((clamped - effectiveBounds.lo) / span) * 100;
  }, [value, effectiveBounds]);

  const isDirty = useMemo(() => {
    if (!category) return false;
    // Add flow (Set budget for a category with no existing limit)
    // stays auto-dirty so the user can save the suggested value in
    // one click without nudging the slider — confirmed UX.
    if (!isExisting) return true;
    const snap = initialSnapshotRef.current;
    // No snapshot yet means the open-effect hasn't run for this
    // open cycle — defer to "not dirty" so the first-render gap
    // doesn't trip confirmOnDirty.
    if (!snap) return false;
    if (value !== snap.value) return true;
    if (penalty !== snap.penalty) return true;
    return false;
  }, [category, isExisting, value, penalty]);

  // Field → state sync. In-range typed numbers commit live so the
  // slider tracks the field on every keystroke. Out-of-range typed
  // numbers defer for CUSTOM_DEBOUNCE_MS so the user can finish a
  // multi-digit value without the bounds jumping mid-stroke. Blur /
  // Enter commits any pending value immediately.
  function handleDraftChange(next: string) {
    setDraft(next);
    if (next.trim() === '') {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    const num = Number(next);
    if (!Number.isFinite(num) || num < 0) return;
    const inObservedRange = num >= baseMin && num <= baseMax;
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (inObservedRange) {
      setValue(snapToStep(num, step));
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      setValue(snapToStep(num, step));
    }, CUSTOM_DEBOUNCE_MS);
  }

  function commitDraft() {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const num = Number(draft);
    if (!Number.isFinite(num) || num < 0) {
      // Reset the draft to the last committed value if the user
      // leaves an invalid string in the field.
      setDraft(String(value));
      return;
    }
    setValue(snapToStep(num, step));
  }

  // Slider → field sync. Drag (or ± buttons) updates `value` AND the
  // draft text so the two stay locked together.
  function setValueAndDraft(next: number) {
    setValue(next);
    setDraft(String(next));
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  return {
    isExisting,
    baseMin,
    baseAvg,
    baseMax,
    value,
    draft,
    penalty,
    error: mutations.error,
    saving: mutations.saving,
    removing: mutations.removing,
    confirmRemoveOpen: mutations.confirmRemoveOpen,
    step,
    effectiveBounds,
    bubblePercent,
    isDirty,
    setPenalty,
    setConfirmRemoveOpen: mutations.setConfirmRemoveOpen,
    handleDraftChange,
    commitDraft,
    setValueAndDraft,
    handleSave: mutations.handleSave,
    handleConfirmRemove: mutations.handleConfirmRemove,
  };
}

export function BudgetFormDialog({
  open,
  onClose,
  category,
  onSaved,
}: BudgetFormDialogProps) {
  const form = useBudgetForm(category, open, onSaved, onClose);
  // Resolve money formatting at this (always-mounted) level rather than
  // inside BudgetFormBody so the currencies reference-data query subscribes
  // on page mount — warming it before the budget cards first render. Passed
  // down as props to the body.
  const { money, currencyCode } = useMoneyFormatter();

  const title = dialogTitle(category, form.isExisting);
  const dismissLabel = form.isDirty ? 'Cancel' : 'Close';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="md"
        title={title}
        description={
          category?.tag_type ? `Category type: ${category.tag_type}` : undefined
        }
        confirmOnDirty
        isDirty={form.isDirty}
        headerActions={
          form.isExisting ? (
            <button
              type="button"
              onClick={() => form.setConfirmRemoveOpen(true)}
              disabled={form.saving || form.removing}
              aria-label="Remove budget"
              title="Remove budget"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              data-testid="budget-form-remove"
            >
              <Trash2 aria-hidden size={16} />
            </button>
          ) : null
        }
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={form.saving || form.removing}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {dismissLabel}
            </button>
            <button
              type="button"
              onClick={() => void form.handleSave()}
              disabled={form.saving || form.removing || !form.isDirty || !category}
              className="btn-primary !w-auto"
              data-testid="budget-form-save"
            >
              {saveButtonLabel(form.saving, form.isExisting)}
            </button>
          </>
        }
      >
        {category && (
          <BudgetFormBody
            category={category}
            money={money}
            currencyCode={currencyCode}
            baseMin={form.baseMin}
            baseAvg={form.baseAvg}
            baseMax={form.baseMax}
            draft={form.draft}
            value={form.value}
            step={form.step}
            effectiveBounds={form.effectiveBounds}
            bubblePercent={form.bubblePercent}
            penalty={form.penalty}
            error={form.error}
            onDraftChange={form.handleDraftChange}
            onCommitDraft={form.commitDraft}
            onValueAndDraft={form.setValueAndDraft}
            onPenaltyChange={form.setPenalty}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={form.confirmRemoveOpen}
        title="Remove this budget?"
        message={
          category
            ? `This drops the configured budget for ${category.tag_name}. Spend in this category will still be tracked, but it won't be measured against a limit until you set a new one.`
            : ''
        }
        confirmLabel="Remove"
        intent="danger"
        busy={form.removing}
        onConfirm={form.handleConfirmRemove}
        onClose={() => form.setConfirmRemoveOpen(false)}
      />
    </>
  );
}

interface BudgetFormBodyProps {
  category: BudgetCategory;
  money: (n: number | string | null | undefined) => string;
  currencyCode: string;
  baseMin: number;
  baseAvg: number;
  baseMax: number;
  draft: string;
  value: number;
  step: number;
  effectiveBounds: { lo: number; hi: number };
  bubblePercent: number;
  penalty: string;
  error: string | null;
  onDraftChange: (next: string) => void;
  onCommitDraft: () => void;
  onValueAndDraft: (next: number) => void;
  onPenaltyChange: (next: string) => void;
}

// The dialog's scrollable content: spent-this-month headline, the
// field+slider monthly-limit control, the penalty rate, and the error
// banner. Split out of BudgetFormDialog purely to keep that component
// under the line-count / complexity gates — all state lives in the
// useBudgetForm hook and arrives as props.
function BudgetFormBody({
  category,
  money,
  currencyCode,
  baseMin,
  baseAvg,
  baseMax,
  draft,
  value,
  step,
  effectiveBounds,
  bubblePercent,
  penalty,
  error,
  onDraftChange,
  onCommitDraft,
  onValueAndDraft,
  onPenaltyChange,
}: BudgetFormBodyProps) {
  return (
    <div className="flex flex-col gap-5 text-slate-700 dark:text-slate-200">
      {/* Current-period headline — surfaces the same "Spent this
          month" value the card shows so the user has the context
          in-modal without having to glance back. */}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Spent this month
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 money dark:text-slate-100">
          {money(category.current_net_expense)}
        </div>
      </div>

      {/* Monthly limit — field + slider stay in sync. */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Monthly limit
        </legend>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          <span>Amount</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitDraft();
              }
            }}
            className="form-input !text-base font-semibold tabular-nums"
            aria-label="Monthly limit amount"
            data-testid="budget-amount-input"
          />
          <span>
            Type a precise value for round numbers; use the slider
            to visualize it against recent spending. Out-of-range
            values settle ~1s after you stop typing.
          </span>
        </label>

        <div className="flex items-center gap-2">
          <StepButton
            icon="minus"
            onClick={() =>
              onValueAndDraft(
                Math.max(
                  effectiveBounds.lo,
                  snapToStep(value - step, step)
                )
              )
            }
            label={`Decrease by ${step}`}
          />
          <div className="flex-1">
            <SliderWithBubble
              value={value}
              onChange={onValueAndDraft}
              min={effectiveBounds.lo}
              max={effectiveBounds.hi}
              step={step}
              bubblePercent={bubblePercent}
              renderBubble={(v) => money(v)}
            />
          </div>
          <StepButton
            icon="plus"
            onClick={() =>
              onValueAndDraft(
                Math.min(
                  effectiveBounds.hi,
                  snapToStep(value + step, step)
                )
              )
            }
            label={`Increase by ${step}`}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Min{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {money(baseMin)}
            </strong>
          </span>
          <span>
            Avg{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {money(baseAvg)}
            </strong>
          </span>
          <span>
            Max{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {money(baseMax)}
            </strong>
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Soft cap in {currencyCode}. Spend above this triggers the
          penalty rate below, stacked on the base taxation rate for{' '}
          <span className="capitalize">{category.tag_type}</span>{' '}
          transactions.
        </p>
      </fieldset>

      {/* Penalty rate. */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Penalty rate
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={penalty}
          onChange={(e) => onPenaltyChange(e.target.value)}
          className="form-input"
          aria-label="Penalty rate"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Accepts <code>5%</code>, <code>0.05</code>, or <code>5</code>{' '}
          (assumed %). Applied on top of base tax when this month&rsquo;s
          spend crosses the limit. Default for{' '}
          <span className="capitalize">{category.tag_type}</span>{' '}
          transactions is{' '}
          {formatRateForInput(category.default_penalty_rate ?? 0.05)}.
        </span>
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </div>
      )}
    </div>
  );
}

interface StepButtonProps {
  icon: 'minus' | 'plus';
  onClick: () => void;
  label: string;
}

function StepButton({ icon, onClick, label }: StepButtonProps) {
  const Icon = icon === 'minus' ? Minus : Plus;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
      data-testid={`budget-slider-step-${icon}`}
    >
      <Icon aria-hidden size={16} />
    </button>
  );
}

interface SliderWithBubbleProps {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  bubblePercent: number;
  renderBubble: (v: number) => string;
}

function SliderWithBubble({
  value,
  onChange,
  min,
  max,
  step,
  bubblePercent,
  renderBubble,
}: SliderWithBubbleProps) {
  const safeMax = max > min ? max : min + 1;
  return (
    <div className="relative pt-9">
      <div
        className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white shadow-md dark:bg-indigo-500"
        style={{ left: `${bubblePercent}%` }}
        data-testid="budget-slider-bubble"
      >
        {renderBubble(value)}
        <span
          className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-indigo-600 dark:bg-indigo-500"
          aria-hidden
        />
      </div>
      <input
        type="range"
        min={min}
        max={safeMax}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-indigo-600 dark:accent-indigo-400"
        aria-label="Monthly limit"
        data-testid="budget-slider"
      />
    </div>
  );
}
