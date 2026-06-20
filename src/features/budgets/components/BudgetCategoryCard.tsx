import { MoreHorizontal } from 'lucide-react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { highlightClass } from '../../../shared/utils/highlight';
import type { BudgetCategory } from '../api/queries';
import { formatRateForInput } from '../api/rateInput';

import { BudgetSignal } from './BudgetSignal';
import { SpendGauge } from './SpendGauge';

interface BudgetCategoryCardProps {
  category: BudgetCategory;
  isHighlighted: boolean;
  onEdit: (category: BudgetCategory) => void;
  // When `true` paints the card as the "global total" surface: indigo
  // accent + larger emphasis. The total row reuses the same component
  // so card layout / typography stay consistent between the two surfaces.
  emphasis?: boolean;
  // Optional slot rendered inline with the title (after the heading,
  // alongside any chips).
  titleExtra?: React.ReactNode;
  // When false, hides the `tag_type` chip (the Total card sets this off —
  // "Total Budget" + "total" is redundant).
  showTypeChip?: boolean;
}

// Read-only category card (view surface; edit happens in `BudgetFormDialog`).
// State is conveyed by a single `BudgetSignal` pill in the header (which unifies
// the former status word + anomaly badge) and the `SpendGauge` bar — both driven
// by the same classifier, so a card reads consistently whether or not a budget
// limit is set. Min/Max no longer clutter the card; they live on the trend card.
export function BudgetCategoryCard({
  category,
  isHighlighted,
  onEdit,
  emphasis = false,
  titleExtra,
  showTypeChip = true,
}: BudgetCategoryCardProps) {
  const { money } = useMoneyFormatter();

  const current = category.current_net_expense ?? 0;
  const hasLimit = category.limit_amt != null && category.limit_amt > 0;

  const ringClass = highlightClass(isHighlighted);

  const cardBase = emphasis
    ? 'bg-accent-50/60 border-accent-200 dark:bg-accent-950/30 dark:border-accent-900/60'
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
          className="money"
        />
        <LabelValue
          label="Monthly limit"
          value={hasLimit ? money(category.limit_amt) : '—'}
          className="money"
        />
        {!emphasis && (
          <LabelValue
            label="Average monthly spend"
            value={money(category.avg_net_expense)}
            tone="muted"
            className="money"
          />
        )}
      </dl>

      <div className="mt-4">
        <SpendGauge
          current={current}
          limit={category.limit_amt}
          avg={category.avg_net_expense}
          min={category.min_net_expense}
          max={category.max_net_expense}
        />
      </div>

      <PenaltyNote category={category} hasLimit={hasLimit} />
    </article>
  );
}

interface CardHeaderProps {
  category: BudgetCategory;
  emphasis: boolean;
  showTypeChip: boolean;
  titleExtra?: React.ReactNode;
  hasLimit: boolean;
  onEdit: (category: BudgetCategory) => void;
}

function CardHeader({
  category,
  emphasis,
  showTypeChip,
  titleExtra,
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
                ? 'text-accent-800 dark:text-accent-100 text-lg'
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
          <BudgetSignal category={category} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onEdit(category)}
        aria-label={`${hasLimit ? 'View / edit' : 'Set'} budget for ${category.tag_name}`}
        title={hasLimit ? 'View / edit budget' : 'Set budget'}
        data-testid={`budget-card-edit-${category.tag_id}`}
        className="focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <MoreHorizontal aria-hidden size={16} />
      </button>
    </header>
  );
}

// Footer note — base penalty rate + the tag-type default fallback. Rendered
// only when a limit is set and the backend surfaced a penalty rate.
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
  tone?: 'default' | 'muted';
  className?: string;
}

function LabelValue({
  label,
  value,
  tone = 'default',
  className = '',
}: LabelValueProps) {
  const valueColor =
    tone === 'muted'
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
