import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import {
  useBudgetStatusQuery,
  type BudgetCategory,
} from '../../budgets/api/queries';

// Surfaces every category that's currently over its monthly budget.
// Lives in the secondary widgets column (desktop only) so the primary
// cards stay glanceable; a "sticky" prominence when any breach exists
// is achieved via the rose-tinted border + the position above the
// other secondary widgets.
//
// Hidden entirely when there are no breaches — empty space beats an
// empty alert in the secondary column.
export function BreachAlertsWidget() {
  const { money } = useMoneyFormatter();

  const { data } = useBudgetStatusQuery(null);

  const breached = useMemo<BudgetCategory[]>(() => {
    const cats = data?.categories ?? [];
    return cats
      .filter(
        (c) =>
          c.limit_amt != null &&
          c.limit_amt > 0 &&
          (c.current_net_expense ?? 0) > c.limit_amt
      )
      .sort(
        (a, b) =>
          (b.current_net_expense ?? 0) / (b.limit_amt ?? 1) -
          (a.current_net_expense ?? 0) / (a.limit_amt ?? 1)
      );
  }, [data]);

  if (breached.length === 0) return null;

  return (
    <section
      data-testid="dashboard-breach-alerts"
      className="border-danger-300 bg-danger-50 dark:border-danger-800/60 dark:bg-danger-950/30 rounded-lg border p-3 shadow-sm"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-danger-800 dark:text-danger-200 text-sm font-semibold">
          Budget breaches
        </h3>
        <span className="text-danger-700 dark:text-danger-300 text-xs font-medium">
          {breached.length} this month
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {breached.map((c) => {
          const limit = c.limit_amt as number;
          const current = c.current_net_expense ?? 0;
          const over = current - limit;
          return (
            <li
              key={c.tag_id}
              className="flex items-center justify-between gap-2 text-xs"
              data-testid={`dashboard-breach-${c.tag_id}`}
            >
              <span className="text-danger-900 dark:text-danger-100 truncate font-medium">
                {c.tag_name}
              </span>
              <span className="text-danger-800 money dark:text-danger-200 shrink-0 tabular-nums">
                +{money(over)} over
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        to="/budgets"
        className="text-danger-800 dark:text-danger-200 mt-2 inline-block text-xs font-semibold hover:underline"
      >
        Review budgets →
      </Link>
    </section>
  );
}
