import { MoreHorizontal } from 'lucide-react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
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
  const { money } = useMoneyFormatter();

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
      <CardHeader
        category={category}
        emphasis={emphasis}
        showTypeChip={showTypeChip}
        titleExtra={titleExtra}
        isOver={isOver}
        hasLimit={hasLimit}
        onEdit={onEdit}
      />

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

      <PenaltyNote category={category} hasLimit={hasLimit} />
    </article>
  );
}

// Header strip — `flex` (no wrap) + `min-w-0` on the title block + `shrink-0`
// on the action keeps the Edit button anchored at the top-right at every
// viewport. The optional `titleExtra` slot (e.g. month selector on the Total
// card) renders inline with the title so the right cluster stays clean.
// Split out of BudgetCategoryCard to keep the parent's render branch count
// under the complexity gate — all logic stays presentational.
interface CardHeaderProps {
  category: BudgetCategory;
  emphasis: boolean;
  showTypeChip: boolean;
  titleExtra?: React.ReactNode;
  isOver: boolean;
  hasLimit: boolean;
  onEdit: (category: BudgetCategory) => void;
}

function CardHeader({
  category,
  emphasis,
  showTypeChip,
  titleExtra,
  isOver,
  hasLimit,
  onEdit,
}: CardHeaderProps) {
  return (
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
          <AnomalyBadge category={category} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onEdit(category)}
        aria-label={`${hasLimit ? 'View / edit' : 'Set'} budget for ${category.tag_name}`}
        title={hasLimit ? 'View / edit budget' : 'Set budget'}
        data-testid={`budget-card-edit-${category.tag_id}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <MoreHorizontal aria-hidden size={16} />
      </button>
    </header>
  );
}

// Footer note — base penalty rate + the tag-type default fallback. Rendered
// only when a limit is set and the backend surfaced a penalty rate. Split out
// for the same complexity-gate reason as CardHeader.
function PenaltyNote({
  category,
  hasLimit,
}: {
  category: BudgetCategory;
  hasLimit: boolean;
}) {
  if (!hasLimit || category.penalty_rate == null) return null;
  return (
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
      Penalty rate:{' '}
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {formatRateForInput(category.penalty_rate)}
      </span>{' '}
      (default for {category.tag_type}:{' '}
      {formatRateForInput(category.default_penalty_rate ?? 0.05)})
    </p>
  );
}

interface LabelValueProps {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'rose';
  className?: string;
}

// Value colour by tone — if/else (not a nested ternary) so it reads cleanly
// and stays off sonarjs/no-nested-conditional.
function labelValueToneClass(tone: 'default' | 'muted' | 'rose'): string {
  if (tone === 'rose') return 'text-rose-700 dark:text-rose-300';
  if (tone === 'muted') return 'text-slate-600 dark:text-slate-300';
  return 'text-slate-900 dark:text-slate-100';
}

function LabelValue({
  label,
  value,
  tone = 'default',
  className = '',
}: LabelValueProps) {
  const valueColor = labelValueToneClass(tone);
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

// Anomaly indicator — compares the current month's spend against the
// historical avg / min / max columns the backend already produces on
// the budget-status payload. Single-month signal; the spec lock for
// Batch 9.5 (frontend-only, no backend change) classifies into 4
// bands matching CONTRIBUTING §6 colour discipline.
//
//   below typical : current ≤ avg * 0.75              (emerald)
//   typical       : avg * 0.75 < current ≤ avg * 1.25 (slate)
//   near max      : avg * 1.25 < current ≤ max        (amber)
//   above max     : current > max                     (rose)
//
// We render nothing when there's no historical signal to compare against
// (avg null / 0 — fresh sign-up before a full month rolls over) so the
// card doesn't carry a misleading "typical" chip on day 1.
type AnomalyBand = 'below' | 'typical' | 'near' | 'above';

interface AnomalyDescriptor {
  band: AnomalyBand;
  label: string;
  className: string;
  // Plain-language tooltip — surfaces "why this band" without a
  // help-icon click. Helps users new to the avg/min/max model.
  title: string;
}

function classifyAnomaly(
  category: BudgetCategory
): AnomalyDescriptor | null {
  const current = category.current_expense ?? 0;
  const avg = category.avg_expense ?? 0;
  const max = category.max_expense ?? 0;
  // No historical aggregate to compare against (or no current spend
  // at all). Hide the badge.
  if (avg <= 0 || current <= 0) return null;

  // Order matters — `above` check must precede `near` since a value
  // that is both > avg*1.25 AND > max would otherwise fall through to
  // `near`. Max can be 0 if the backend hasn't surfaced it; treat that
  // as "no upper bound" and skip the above/near distinction.
  if (max > 0 && current > max) {
    return {
      band: 'above',
      label: 'Above typical max',
      className:
        'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200',
      title: `Spent ${pct((current - max) / Math.max(max, 1))} above the highest month on record.`,
    };
  }
  if (current > avg * 1.25) {
    return {
      band: 'near',
      label: 'Near typical max',
      className:
        'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
      title: `Spent ${pct((current - avg) / avg)} above the average. Watch the rest of the month.`,
    };
  }
  if (current < avg * 0.75) {
    return {
      band: 'below',
      label: 'Below typical',
      className:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200',
      title: `Spent ${pct((avg - current) / avg)} under the average. Quiet month so far.`,
    };
  }
  return {
    band: 'typical',
    label: 'Typical',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    title: 'Within the typical monthly range.',
  };
}

function pct(fraction: number): string {
  return `${Math.round(Math.abs(fraction) * 100)}%`;
}

function AnomalyBadge({ category }: { category: BudgetCategory }) {
  const anomaly = classifyAnomaly(category);
  if (!anomaly) return null;
  return (
    <span
      title={anomaly.title}
      data-testid={`budget-anomaly-${anomaly.band}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${anomaly.className}`}
    >
      {anomaly.label}
    </span>
  );
}

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
