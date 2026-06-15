import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import {
  computeBudgetSignal,
  SIGNAL_STYLE,
  spendPercent,
  type SignalInput,
} from '../lib/budgetSignal';

// The single status indicator for a budget category (Zone 1 overview + Zone 3
// cards). Replaces the old status-word + AnomalyBadge pair: one pill whose
// label + colour encode the most relevant state, with the secondary dimension
// (the rolling "typical", or the breach overshoot) carried in the tooltip.
interface BudgetSignalProps {
  category: SignalInput;
  className?: string;
}

function buildTitle(
  c: SignalInput,
  money: (n: number | null | undefined) => string
): string {
  const current = c.current_net_expense ?? 0;
  const avg = c.avg_net_expense ?? 0;
  const max = c.max_net_expense ?? 0;
  const hasLimit = c.limit_amt != null && c.limit_amt > 0;

  if (hasLimit) {
    const pct = Math.round(spendPercent(current, c.limit_amt));
    const parts = [`${money(current)} of ${money(c.limit_amt)} (${pct}%)`];
    if (avg > 0) parts.push(`typically ${money(avg)}`);
    if (current > (c.limit_amt ?? 0) && max > 0 && current > max) {
      parts.push('most expensive yet');
    }
    return parts.join(' · ');
  }
  if (avg <= 0 || current <= 0) return 'No spending history yet';
  return `${money(current)} vs your typical ${money(avg)}`;
}

export function BudgetSignal({ category, className = '' }: BudgetSignalProps) {
  const { money } = useMoneyFormatter();
  const state = computeBudgetSignal(category);
  const style = SIGNAL_STYLE[state.tone];
  return (
    <span
      title={buildTitle(category, money)}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.pill} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      {state.label}
    </span>
  );
}
