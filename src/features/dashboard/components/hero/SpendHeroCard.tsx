import { useMemo } from 'react';

import {
  MiniBars,
  MiniLine,
  type TrendPoint,
} from '../../../../shared/components/charts/trendCharts';
import { useMoneyFormatter } from '../../../../shared/hooks/useMoneyFormatter';
import { useAuthStore } from '../../../../shared/state/auth.store';
import { formatYearMonth } from '../../../../shared/utils/dateUtils';
import { useBudgetStatusQuery } from '../../../budgets/api/queries';
import { useExpenseTrendQuery } from '../../api/queries';

import { HeroNumber } from './HeroNumber';
import { HeroShell } from './HeroShell';

const SPARK_WEEKS = 8;

function makeCompact(symbol: string | null): (n: number) => string {
  const fmt = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return (n: number) => `${symbol ?? ''}${fmt.format(n)}`;
}

function weekLabel(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return periodStart;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

// The off-mode hero. With taxation disabled the app is a plain expense tracker,
// so spend leads: this month's total (count-up), budget headroom, and a weekly
// spend spark. Composes the budgets read-model (month rollup) + the dashboard's
// own expense-trend query (weekly total series) — no taxation reads, since the
// engine is off. Deep-links to the Expense Tracker.
export function SpendHeroCard() {
  const { money, currencySymbol } = useMoneyFormatter();
  const totalTagId = useAuthStore((s) => s.constants)?.TOTAL_TAG_ID;
  const compact = useMemo(() => makeCompact(currencySymbol), [currencySymbol]);

  const { data: budget, isLoading } = useBudgetStatusQuery(null);
  const trendQ = useExpenseTrendQuery(
    'weekly',
    SPARK_WEEKS,
    totalTagId,
    totalTagId != null
  );

  const points: TrendPoint[] = useMemo(() => {
    const rows = (trendQ.data?.rows ?? [])
      .filter((r) => r.tag_id === totalTagId)
      .sort((a, b) => a.period_start.localeCompare(b.period_start));
    return rows.map((r) => ({
      label: weekLabel(r.period_start),
      value: Math.max(0, r.net_expense),
    }));
  }, [trendQ.data, totalTagId]);

  if (isLoading && budget == null) {
    return (
      <HeroShell eyebrow="Spent this month" testId="dashboard-hero-spend">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      </HeroShell>
    );
  }

  const total = budget?.total_budget ?? null;
  const spent = total?.current_net_expense ?? 0;
  const limit = total?.limit_amt ?? 0;
  const hasLimit = limit > 0;
  const pctUsed = hasLimit ? Math.round((spent / limit) * 100) : null;
  const useBars = points.length <= 5;

  return (
    <HeroShell
      eyebrow={`Spent this month · ${formatYearMonth(budget?.month, 'short')}`}
      footer={{ href: '/budgets', label: 'Expense Tracker' }}
      testId="dashboard-hero-spend"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <HeroNumber
            value={spent}
            testId="dashboard-hero-spend-total"
            className="text-4xl font-semibold text-slate-900 dark:text-slate-100"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hasLimit ? (
              <>
                <span
                  className="font-semibold text-slate-700 dark:text-slate-200"
                  data-testid="dashboard-hero-spend-pct"
                >
                  {pctUsed}% of {money(limit)}
                </span>{' '}
                monthly limit
              </>
            ) : (
              'No monthly limit set'
            )}
          </p>
        </div>
      </div>

      {points.length > 0 ? (
        <div className="mt-4">
          {useBars ? (
            <MiniBars
              data={points}
              money={money}
              compact={compact}
              heightClass="h-28 w-full"
            />
          ) : (
            <MiniLine
              data={points}
              money={money}
              compact={compact}
              heightClass="h-28 w-full"
            />
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          No spending recorded yet this period.
        </p>
      )}
    </HeroShell>
  );
}
