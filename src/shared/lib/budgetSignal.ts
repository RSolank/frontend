// The unified budget/spend signal — one classifier that drives both the
// `BudgetSignal` pill and the `SpendGauge` fill, so a category never shows the
// old duplicated "status pill + anomaly badge" pair. It has two modes:
//
//   • limit set  → position vs the budget limit (On track → Over budget)
//   • no limit   → position vs the rolling "typical" baseline the BE stores
//                  on every row (avg/min/max over a trailing window), so a
//                  budget-less category still reads as below / typical / above.
//
// Colours reuse the existing FE semantic tokens (success / warning / orange /
// danger / slate). Pure, presentation-agnostic — lives in `shared/lib` so both
// the budgets feature (BudgetSignal / SpendGauge) and the dashboard analytics
// zone classify spend the same way without a cross-feature import.

export type SignalTone = 'safe' | 'watch' | 'near' | 'over' | 'neutral';

export interface SignalInput {
  current_net_expense: number | null;
  avg_net_expense: number | null;
  max_net_expense: number | null;
  limit_amt: number | null;
}

export interface SignalState {
  tone: SignalTone;
  label: string;
  hasLimit: boolean;
}

/** Raw spend-vs-limit percentage (0 when no limit). Bar width caps this at 100. */
export function spendPercent(
  current: number,
  limit: number | null | undefined
): number {
  return limit != null && limit > 0 ? (current / limit) * 100 : 0;
}

export function computeBudgetSignal(c: SignalInput): SignalState {
  const current = c.current_net_expense ?? 0;
  const avg = c.avg_net_expense ?? 0;
  const max = c.max_net_expense ?? 0;
  const hasLimit = c.limit_amt != null && c.limit_amt > 0;

  if (hasLimit) {
    const pct = spendPercent(current, c.limit_amt);
    if (pct > 100) return { tone: 'over', label: 'Over budget', hasLimit };
    if (pct >= 85) return { tone: 'near', label: 'Near limit', hasLimit };
    if (pct >= 60) return { tone: 'watch', label: 'Watch', hasLimit };
    return { tone: 'safe', label: 'On track', hasLimit };
  }

  // No limit → compare against the rolling typical baseline. No spend or no
  // history yet → neutral (the caller surfaces a "Set a budget" nudge).
  if (current <= 0 || avg <= 0) {
    return { tone: 'neutral', label: 'No budget set', hasLimit };
  }
  if (max > 0 && current > max) {
    return { tone: 'over', label: 'Most expensive yet', hasLimit };
  }
  if (current > avg * 1.25) {
    return { tone: 'watch', label: 'Above typical', hasLimit };
  }
  if (current < avg * 0.75) {
    return { tone: 'safe', label: 'Below typical', hasLimit };
  }
  return { tone: 'neutral', label: 'Typical', hasLimit };
}

// Tone → Tailwind classes. `pill` = the BudgetSignal chip, `bar` = the
// SpendGauge fill, `dot` = the pill's leading dot.
export const SIGNAL_STYLE: Record<
  SignalTone,
  { pill: string; bar: string; dot: string }
> = {
  safe: {
    pill: 'bg-success-100 text-success-700 dark:bg-success-950/60 dark:text-success-200',
    bar: 'bg-success-500 dark:bg-success-400',
    dot: 'bg-success-500',
  },
  watch: {
    pill: 'bg-warning-100 text-warning-800 dark:bg-warning-950/60 dark:text-warning-200',
    bar: 'bg-warning-500 dark:bg-warning-400',
    dot: 'bg-warning-500',
  },
  near: {
    pill: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-200',
    bar: 'bg-orange-500 dark:bg-orange-400',
    dot: 'bg-orange-500',
  },
  over: {
    pill: 'bg-danger-100 text-danger-700 dark:bg-danger-950/60 dark:text-danger-200',
    bar: 'bg-danger-500 dark:bg-danger-400',
    dot: 'bg-danger-500',
  },
  neutral: {
    pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    bar: 'bg-slate-400 dark:bg-slate-500',
    dot: 'bg-slate-400',
  },
};
