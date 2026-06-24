import { useMemo } from 'react';

import {
  MiniBars,
  MiniLine,
  type TrendPoint,
} from '../../../../shared/components/charts/trendCharts';
import { useMoneyFormatter } from '../../../../shared/hooks/useMoneyFormatter';
import { useTreasurySummaryQuery } from '../../../treasury/api/queries';

import { HeroNumber } from './HeroNumber';
import { HeroShell } from './HeroShell';

// Compact money for the spark's y-axis (₹50k) — runtime locale drives it.
function makeCompact(symbol: string | null): (n: number) => string {
  const fmt = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return (n: number) => `${symbol ?? ''}${fmt.format(n)}`;
}

// "23 Jun" axis label for an ISO week-end (formatted at UTC — a week-end has no
// timezone of its own).
function weekLabel(periodEnd: string): string {
  const d = new Date(`${periodEnd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return periodEnd;
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

// Hero-right (normal mode): the set-aside trajectory — the signature
// future-portfolio metric. Big funded balance (count-up), coverage of the
// levied provision, this-week delta, and a compact emerald spark of the running
// balance. Reads the same `GET /treasury/summary` the Savings page does (its
// public api hook), so the two never diverge; deep-links to the full page.
export function SavingsHeroCard() {
  const { money, currencySymbol } = useMoneyFormatter();
  const { data, isLoading } = useTreasurySummaryQuery();
  const compact = useMemo(() => makeCompact(currencySymbol), [currencySymbol]);

  const points: TrendPoint[] = useMemo(
    () =>
      (data?.trend ?? []).map((p) => ({
        label: weekLabel(p.period_end),
        value: p.cumulative_balance,
      })),
    [data]
  );

  if (isLoading && data == null) {
    return (
      <HeroShell eyebrow="Set aside" testId="dashboard-hero-savings">
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      </HeroShell>
    );
  }

  const funded = data?.funded_balance ?? 0;
  const provisioned = data?.provisioned_total ?? 0;
  const coveragePct =
    provisioned > 0 ? Math.round((funded / provisioned) * 100) : null;
  const weekDelta = data?.trend?.at(-1)?.delta ?? 0;
  const useBars = points.length <= 5;

  return (
    <HeroShell
      eyebrow="Set aside"
      footer={{ href: '/treasury', label: 'Savings' }}
      testId="dashboard-hero-savings"
    >
      <HeroNumber
        value={funded}
        testId="dashboard-hero-savings-balance"
        className="text-4xl font-semibold text-emerald-600 dark:text-emerald-400"
      />

      <dl className="mt-3 flex gap-6">
        <div>
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Coverage
          </dt>
          <dd
            className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
            data-testid="dashboard-hero-savings-coverage"
          >
            {coveragePct == null ? '—' : `${coveragePct}%`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
            This week
          </dt>
          <dd className="money mt-0.5 text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
            {weekDelta >= 0 ? '+' : ''}
            {money(weekDelta)}
          </dd>
        </div>
      </dl>

      <SavingsSpark
        points={points}
        show={points.length > 0 && funded > 0}
        useBars={useBars}
        money={money}
        compact={compact}
      />
    </HeroShell>
  );
}

// The compact emerald set-aside spark (bars for short windows, line otherwise),
// or a gentle hint when there's nothing to plot yet. Extracted so the card's
// branchy data-prep stays under the complexity budget.
function SavingsSpark({
  points,
  show,
  useBars,
  money,
  compact,
}: {
  points: TrendPoint[];
  show: boolean;
  useBars: boolean;
  money: (n: number | null | undefined) => string;
  compact: (n: number) => string;
}) {
  if (!show) {
    return (
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Your set-aside balance grows as weekly bills are settled.
      </p>
    );
  }
  return (
    <div className="mt-3">
      {useBars ? (
        <MiniBars
          data={points}
          money={money}
          compact={compact}
          heightClass="h-24 w-full"
          barClass="fill-emerald-500 dark:fill-emerald-400"
        />
      ) : (
        <MiniLine
          data={points}
          money={money}
          compact={compact}
          heightClass="h-24 w-full"
          lineClass="stroke-emerald-500 dark:stroke-emerald-400"
          areaClass="fill-emerald-500/10 dark:fill-emerald-400/10"
          dotClass="fill-emerald-600 dark:fill-emerald-300"
        />
      )}
    </div>
  );
}
