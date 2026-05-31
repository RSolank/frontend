import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useUrlValueModal } from '../../../shared/hooks/useModal';
import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { formatYearMonth } from '../../../shared/utils/dateUtils';
import { budgetKeys } from '../api/keys';
import {
  useBudgetStatusQuery,
  type BudgetCategory,
} from '../api/queries';
import { BudgetCategoryCard } from '../components/BudgetCategoryCard';
import { BudgetFormDialog } from '../components/BudgetFormDialog';

export function ExpenseTrackerPage() {
  const queryClient = useQueryClient();
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const { data, isLoading, error } = useBudgetStatusQuery(activeMonth);

  const editModal = useUrlValueModal('edit');
  const editTagId = editModal.value != null ? Number(editModal.value) : null;
  const { id: highlightTagId, flash } = useRowHighlight<number>();

  // Categories grid filter — match the Batch 8 close behavior: keep any
  // category with spend OR a configured limit. Idle/empty cells stay
  // hidden so the grid doesn't sprawl.
  const visibleCategories: BudgetCategory[] = useMemo(() => {
    const cats = data?.categories ?? [];
    return cats.filter(
      (c) =>
        (c.current_expense ?? 0) > 0 ||
        (c.limit_amt != null && c.limit_amt > 0)
    );
  }, [data]);

  const totalBudget: BudgetCategory | null = useMemo(
    () => data?.total_budget ?? null,
    [data]
  );

  // Look up the active edit target by tag_id across (total + categories).
  // Total is editable too — same modal, same POST.
  const editingCategory: BudgetCategory | null = useMemo(() => {
    if (editTagId == null) return null;
    if (totalBudget?.tag_id === editTagId) return totalBudget;
    return data?.categories?.find((c) => c.tag_id === editTagId) ?? null;
  }, [editTagId, totalBudget, data]);

  async function handleSaved(savedTagId: number) {
    await queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    flash(savedTagId);
  }

  function handleEdit(category: BudgetCategory) {
    editModal.openWith(String(category.tag_id));
  }

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setActiveMonth(val || null);
  }

  const displayMonth = data?.month ?? '';
  const availableMonths = data?.available_months ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/*
       * Page header — title + description only. No competing controls
       * so the heading + paragraph stay readable on narrow viewports
       * (no flex-wrap squeeze). The month selector lives in its own
       * row below per the 2026-05-27 layout refinement (next-of-kin
       * to the rollup card, not the breadcrumb).
       */}
      <header className="mb-4">
        <nav className="text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/dashboard"
            className="text-indigo-600 hover:underline dark:text-indigo-300"
          >
            Dashboard
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700 dark:text-slate-200">
            Expense Tracker
          </span>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Expense Tracker
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Monitor monthly spending against per-category budgets. Breaches
          stack a penalty on top of the base tax rate — see Taxation Rules
          for the defaults, or override per-budget below.
        </p>
      </header>

      {/*
       * Month selector — sits on its own row above the rollup card.
       * Closest contextual relative to the cards it scopes; reads
       * cleanly on mobile (own line, no flex-wrap collision with the
       * heading) and on desktop (left-aligned, breathes from both
       * the header and the rollup).
       */}
      {availableMonths.length > 0 && (
        <div className="mb-4">
          {/*
           * No visible label — the dropdown's own option text
           * ("February 2026", etc.) is self-explanatory in this
           * placement (above the rollup card it scopes). aria-label
           * stays for screen readers per the 2026-05-27 design lock.
           */}
          <select
            id="expense-tracker-month-select"
            value={displayMonth}
            onChange={handleMonthChange}
            className="form-input !w-auto min-w-[11rem] !py-1.5 !text-sm"
            aria-label="Active month"
            data-testid="expense-tracker-month-select"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatYearMonth(m, 'long')}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
        >
          Failed to load expense status.
        </div>
      )}

      {isLoading && !data ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {totalBudget && (
            <MonthOverviewCard
              category={totalBudget}
              isHighlighted={highlightTagId === totalBudget.tag_id}
              onEdit={handleEdit}
            />
          )}

          <section
            aria-labelledby="categories-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h2
                id="categories-heading"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Categories
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {visibleCategories.length}{' '}
                {visibleCategories.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            {visibleCategories.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No categorized spending found for{' '}
                {displayMonth ? formatYearMonth(displayMonth, 'long') : 'this month'}.
              </div>
            ) : (
              <div
                className="grid grid-cols-1 gap-3 lg:grid-cols-2"
                data-testid="budget-category-list"
              >
                {visibleCategories.map((cat) => (
                  <BudgetCategoryCard
                    key={cat.tag_id}
                    category={cat}
                    isHighlighted={highlightTagId === cat.tag_id}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <BudgetFormDialog
        open={editingCategory != null}
        category={editingCategory}
        onClose={editModal.close}
        onSaved={handleSaved}
      />
    </div>
  );
}

interface MonthOverviewCardProps {
  category: BudgetCategory;
  isHighlighted: boolean;
  onEdit: (category: BudgetCategory) => void;
}

// Month Overview — the emphasized Total Budget surface (Spent / Limit
// / progress) plus a dedicated "recent months" trends strip below.
// Month selector is intentionally NOT here — it scopes the entire
// page, so it lives in the page header alongside the title.
function MonthOverviewCard({
  category,
  isHighlighted,
  onEdit,
}: MonthOverviewCardProps) {
  const { money } = useMoneyFormatter();

  return (
    <div>
      <BudgetCategoryCard
        category={category}
        isHighlighted={isHighlighted}
        onEdit={onEdit}
        emphasis
        showTypeChip={false}
      />
      <RollingStatsStrip money={money} category={category} />
    </div>
  );
}

interface RollingStatsStripProps {
  category: BudgetCategory;
  money: (n: number | null | undefined) => string;
}

// "Recent months" trends strip — Avg / Min / Max in a dedicated row
// under the Month Overview card. Per the 2026-05-27 lock these are
// rollup-level stats that don't belong on each category card; placing
// them here makes the rollup-vs-detail distinction obvious.
function RollingStatsStrip({ category, money }: RollingStatsStripProps) {
  return (
    <dl
      className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900"
      data-testid="rolling-stats"
    >
      <Stat
        label="Average monthly spend"
        value={money(category.avg_expense)}
      />
      <Stat
        label="Lowest monthly spend"
        value={money(category.min_expense)}
      />
      <Stat
        label="Highest monthly spend"
        value={money(category.max_expense)}
      />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-base font-semibold tabular-nums text-slate-900 money dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}
