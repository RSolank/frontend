import { useMemo } from 'react';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatMoney } from '../../../shared/utils/currency';
import { useCurrenciesQuery } from '../../metadata/api/queries';
import { useTagsQuery, type TagNode } from '../../tags/api/queries';
import { weekRangeInTz } from '../../taxation/api/billPeriod';
import { useTransactionsQuery } from '../../transactions/api/queries';

// Batch 9.5 — week-by-category aggregation rendered alongside the
// month top-3 inside <ExpenseTrackerCard />. Client-side derivation
// from the same `useTransactionsQuery` call TransactionsCard already
// issues for its weekly total — React Query caches by params so the
// network hit is deduped between the two consumers.
//
// Attribution policy: each txn counts under its FIRST tag_id, which
// per the backend categorization engine is the txn's primary (most-
// specific) tag. Lineage ancestors (Food → Total) live further in the
// tag_ids array and aren't double-counted here. Txns with no tags
// land under "Uncategorized" (rare — statement-imported txns get the
// MISCELLANEOUS fallback automatically).
//
// No backend endpoint added in this batch. A future `?group_by=tag` on
// /api/v1/transactions is filed in `.scratch/task-handoff-fe-to-be.md
// §8` for when client-side aggregation gets expensive.

const TOP_LIMIT = 3;
const WEEK_FETCH_LIMIT = 200;

interface WeekTagAgg {
  tag_id: number;
  tag_name: string;
  total: number;
  count: number;
}

function flattenTags(nodes: TagNode[] | undefined): Map<number, TagNode> {
  const map = new Map<number, TagNode>();
  function walk(list: TagNode[] | undefined) {
    if (!list) return;
    for (const n of list) {
      map.set(n.tag_id, n);
      walk(n.children);
    }
  }
  walk(nodes);
  return map;
}

export function WeekByCategoryStrip() {
  const currencyCode = usePreferencesStore((s) => s.currency);
  const timezone = usePreferencesStore((s) => s.timezone);
  const constants = useAuthStore((s) => s.constants);
  const totalTagId = constants?.TOTAL_TAG_ID;

  const { data: currencies } = useCurrenciesQuery();
  const currencySymbol = useMemo(
    () => currencies?.find((c) => c.code === currencyCode)?.symbol ?? null,
    [currencies, currencyCode]
  );
  const money = (n: number) => formatMoney(n, currencyCode, currencySymbol);

  const week = useMemo(() => weekRangeInTz(new Date(), timezone), [timezone]);
  // Mirrors TransactionsCard's month-fallback logic so the two queries
  // share params → React Query dedupes the request.
  const weekCrossesMonth =
    week.period_start.slice(0, 7) !== week.period_end.slice(0, 7);
  const activeMonth = weekCrossesMonth
    ? undefined
    : week.period_start.slice(0, 7);

  const txnQuery = useTransactionsQuery({
    limit: WEEK_FETCH_LIMIT,
    offset: 0,
    sort_by: 'date',
    order: 'desc',
    debit_credit: 'debit',
    ...(activeMonth ? { month: activeMonth } : {}),
  });
  const { data: tagsData } = useTagsQuery();
  const tagIndex = useMemo(
    () => flattenTags(tagsData?.tags),
    [tagsData]
  );

  const top = useMemo<WeekTagAgg[]>(() => {
    const all = txnQuery.data?.transactions ?? [];
    const weekRows = all.filter(
      (t) =>
        t.txn_date >= week.period_start &&
        t.txn_date <= `${week.period_end}T23:59:59`
    );

    const agg = new Map<number, WeekTagAgg>();
    for (const t of weekRows) {
      // First tag = primary per backend categorization. Skip the
      // ancestor-propagated Total tag if it happens to lead (defensive).
      let primary = t.tag_ids[0];
      if (primary === totalTagId && t.tag_ids.length > 1) {
        primary = t.tag_ids[1];
      }
      if (primary == null) continue;
      const node = tagIndex.get(primary);
      const name = node?.tag_name ?? 'Uncategorized';
      const existing = agg.get(primary);
      if (existing) {
        existing.total += Number(t.amount) || 0;
        existing.count += 1;
      } else {
        agg.set(primary, {
          tag_id: primary,
          tag_name: name,
          total: Number(t.amount) || 0,
          count: 1,
        });
      }
    }
    return [...agg.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_LIMIT);
  }, [txnQuery.data, tagIndex, totalTagId, week]);

  // Wait for both queries to resolve before rendering — otherwise tag
  // names fall back to "Uncategorized" on the first paint and flip to
  // real names a tick later, which reads as a layout flicker.
  if (txnQuery.isLoading || !txnQuery.data) {
    return null;
  }
  if (!tagsData) {
    return null;
  }
  if (top.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="dashboard-expense-week-heading"
      data-testid="dashboard-expense-week-list"
      className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3
          id="dashboard-expense-week-heading"
          className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
        >
          Top categories this week
        </h3>
      </header>
      <ul className="flex flex-col gap-1.5">
        {top.map((row) => (
          <li
            key={row.tag_id}
            data-testid={`dashboard-expense-week-row-${row.tag_id}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate font-medium text-slate-800 dark:text-slate-100">
              {row.tag_name}
            </span>
            <span className="ml-2 shrink-0 tabular-nums text-slate-600 money dark:text-slate-300">
              {money(row.total)}
              <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                {row.count} {row.count === 1 ? 'txn' : 'txns'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
