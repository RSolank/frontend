import { useMemo } from 'react';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatMoney } from '../../../shared/utils/currency';
import { useCurrenciesQuery } from '../../metadata/api/queries';
import type { BudgetCategory } from '../api/queries';
import { formatRateForInput } from '../api/rateInput';

interface BudgetCategoryCardProps {
  category: BudgetCategory;
  isHighlighted: boolean;
  onEdit: (category: BudgetCategory) => void;
  // When `true` paints the card as the "global total" surface: indigo
  // accent + larger emphasis. The total row reuses the same component
  // so card layout / typography stay consistent between the two
  // surfaces.
  emphasis?: boolean;
  // Optional slot rendered inline with the title (after the heading,
  // alongside any chips). Used by the Total Budget card to host the
  // month selector on the LEFT of the header row instead of bunched
  // against the Edit affordance on the right (per the 2026-05-27
  // refinement — keeps the action cluster uncluttered).
  titleExtra?: React.ReactNode;
  // When false, hides the `tag_type` chip. The Total card sets this
  // off because "Total Budget" + "total" is redundant; category
  // cards keep the chip since the type is meaningful context.
  showTypeChip?: boolean;
}

// Read-only category card. Per the 2026-05-26 design-principle lock,
// view surfaces show label/value pairs only — edit happens in
// `<BudgetFormDialog />`. Top-line affordance: "Set budget" when no
// limit is configured, "Edit budget" otherwise.
//
// Per the 2026-05-27 design refinement, category cards (the lower
// grid) no longer surface Min/Max — those are aggregate stats most
// meaningful at the rollup level and live on the Total Budget card.
// Category cards focus on Spent / Limit / Avg + progress.
export function BudgetCategoryCard({
  category,
  isHighlighted,
  onEdit,
  emphasis = false,
  titleExtra,
  showTypeChip = true,
}: BudgetCategoryCardProps) {
  const currencyCode = usePreferencesStore((s) => s.currency);
  const { data: currencies } = useCurrenciesQuery();
  const currencySymbol = useMemo(
    () => currencies?.find((c) => c.code === currencyCode)?.symbol ?? null,
    [currencies, currencyCode]
  );
  const money = (n: number | null | undefined) =>
    formatMoney(n ?? 0, currencyCode, currencySymbol);

  const current = category.current_expense ?? 0;
  const limit = category.limit_amt ?? 0;
  const hasLimit = category.limit_amt != null && category.limit_amt > 0;
  const isOver = hasLimit && current > limit;
  // Raw percent — can exceed 100% for over-budget cells. The progress
  // bar caps the bar width internally but keeps the threshold logic
  // honest so a 130% cell paints "Over budget", not "Near limit".
  const percent = hasLimit ? (current / limit) * 100 : 0;

  const ringClass = isHighlighted
    ? 'ring-2 ring-inset ring-indigo-500'
    : 'ring-0';

  const cardBase = emphasis
    ? 'bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/60'
    : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800';

  return (
    <article
      data-testid={`budget-card-${category.tag_id}`}
      className={`rounded-lg border p-4 shadow-sm transition-shadow ${cardBase} ${ringClass}`}
    >
      {/*
       * Header strip — `flex` (no wrap) + `min-w-0` on the title block
       * + `shrink-0` on the action keeps the Edit button anchored at
       * the top-right at every viewport. The optional `titleExtra`
       * slot (e.g. month selector on the Total card) renders inline
       * with the title so the right cluster stays clean.
       */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`truncate font-semibold ${
                emphasis
                  ? 'text-lg text-indigo-800 dark:text-indigo-100'
                  : 'text-base text-slate-900 dark:text-slate-100'
              }`}
            >
              {category.tag_name}
            </h3>
            {titleExtra}
            {showTypeChip && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize dark:bg-slate-800 dark:text-slate-300">
                {category.tag_type}
              </span>
            )}
            {isOver && (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
                Over budget
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onEdit(category)}
          className="shrink-0 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
          aria-label={`${hasLimit ? 'Edit' : 'Set'} budget for ${category.tag_name}`}
          data-testid={`budget-card-edit-${category.tag_id}`}
        >
          {hasLimit ? 'Edit budget' : 'Set budget'}
        </button>
      </header>

      <dl
        className={`mt-3 grid gap-x-6 gap-y-3 ${
          emphasis ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        <LabelValue
          label="Spent this month"
          value={money(current)}
          tone={isOver ? 'rose' : 'default'}
          className="money"
        />
        <LabelValue
          label="Monthly limit"
          value={hasLimit ? money(limit) : '—'}
          className="money"
        />
        {!emphasis && (
          <LabelValue
            label="Average monthly spend"
            value={money(category.avg_expense)}
            tone="muted"
            className="money"
          />
        )}
      </dl>

      <div className="mt-4">
        <ProgressBar percent={percent} hasLimit={hasLimit} />
      </div>

      {hasLimit && category.penalty_rate != null && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Penalty rate:{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {formatRateForInput(category.penalty_rate)}
          </span>{' '}
          (default for {category.tag_type}:{' '}
          {formatRateForInput(category.default_penalty_rate ?? 0.05)})
        </p>
      )}
    </article>
  );
}

interface LabelValueProps {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'rose';
  className?: string;
}

function LabelValue({
  label,
  value,
  tone = 'default',
  className = '',
}: LabelValueProps) {
  const valueColor =
    tone === 'rose'
      ? 'text-rose-700 dark:text-rose-300'
      : tone === 'muted'
        ? 'text-slate-600 dark:text-slate-300'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate text-base font-semibold tabular-nums ${valueColor} ${className}`}
      >
        {value}
      </dd>
    </div>
  );
}

// Progress thresholds — locked 2026-05-27. The same gradation is used
// on every card (Total + category) so the user reads the four colour
// bands consistently across the page.
//
//  ≤ 60%   →  green  — "On track"
//  60–85%  →  amber  — "Watch"
//  85–100% →  orange — "Near limit"
//  > 100%  →  red    — "Over budget"
//
// Bar width is capped at 100% so an over-budget cell doesn't stretch
// the track; the left-side text shows the true percentage (e.g.
// "130% used") so the user still sees how far past the limit they
// are. Colour-coded label on the right replaces the previous neutral
// "X% remaining" text with a status word.
type ProgressStatus = 'safe' | 'watch' | 'near' | 'over';

function statusFor(percent: number): ProgressStatus {
  if (percent > 100) return 'over';
  if (percent >= 85) return 'near';
  if (percent >= 60) return 'watch';
  return 'safe';
}

const STATUS_STYLE: Record<
  ProgressStatus,
  { bar: string; text: string; label: string }
> = {
  safe: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'On track',
  },
  watch: {
    bar: 'bg-amber-500 dark:bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Watch',
  },
  near: {
    bar: 'bg-orange-500 dark:bg-orange-400',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'Near limit',
  },
  over: {
    bar: 'bg-rose-500 dark:bg-rose-400',
    text: 'text-rose-700 dark:text-rose-300',
    label: 'Over budget',
  },
};

function ProgressBar({
  percent,
  hasLimit,
}: {
  percent: number;
  hasLimit: boolean;
}) {
  if (!hasLimit) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No limit configured — set one to track headroom for the month.
      </p>
    );
  }
  const status = statusFor(percent);
  const style = STATUS_STYLE[status];
  const capped = Math.min(percent, 100);
  return (
    <div
      aria-label={`${percent.toFixed(0)}% of limit used — ${style.label}`}
      data-testid={`budget-progress-${status}`}
    >
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full transition-[width] duration-300 ${style.bar}`}
          style={{ width: `${capped}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className={`font-medium tabular-nums ${style.text}`}>
          {percent.toFixed(0)}% used
        </span>
        <span className={`font-semibold ${style.text}`}>
          {style.label}
        </span>
      </div>
    </div>
  );
}
