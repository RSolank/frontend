import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useUrlValueModal } from '../../../shared/hooks/useModal';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { formatYearMonth } from '../../../shared/utils/dateUtils';
import { budgetKeys } from '../api/keys';
import { useBudgetStatusQuery, type BudgetCategory } from '../api/queries';
import { BudgetCategoryCard } from '../components/BudgetCategoryCard';
import { BudgetFormDialog } from '../components/BudgetFormDialog';
import { ExpenseOverviewCard } from '../components/ExpenseOverviewCard';
import { SpendTrendCard } from '../components/SpendTrendCard';

// Expense Tracker — a single analytics dashboard, ordered by importance so a
// casual reader gets the answer up top (Zone 1 overview) and explorers scroll
// to the trend (Zone 2) and per-category budgets (Zone 3). The month selector
// is the page anchor: Zones 1 & 3 snapshot that month, Zone 2's trend ends on
// it. Drill-down into individual transactions lives on the Transactions page —
// here it's cumulative totals, trends, and state only.
export function ExpenseTrackerPage() {
  const queryClient = useQueryClient();
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const { data, isLoading, error } = useBudgetStatusQuery(activeMonth);

  const editModal = useUrlValueModal('edit');
  const editTagId = editModal.value != null ? Number(editModal.value) : null;
  const { id: highlightTagId, flash } = useRowHighlight<number>();

  // Categories grid filter — keep any category with spend OR a configured limit.
  const visibleCategories: BudgetCategory[] = useMemo(() => {
    const cats = data?.categories ?? [];
    return cats.filter(
      (c) =>
        (c.current_net_expense ?? 0) > 0 ||
        (c.limit_amt != null && c.limit_amt > 0)
    );
  }, [data]);

  const totalBudget: BudgetCategory | null = useMemo(
    () => data?.total_budget ?? null,
    [data]
  );

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
    setActiveMonth(e.target.value || null);
  }

  const displayMonth = data?.month ?? '';
  const availableMonths = data?.available_months ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <nav className="text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/dashboard"
            className="text-accent-600 dark:text-accent-300 hover:underline"
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
          Your spending at a glance — totals, trends, and per-category budgets.
          Breaches stack a penalty on top of the base tax; see Taxation Rules for
          the defaults, or override per-budget below.
        </p>
      </header>

      {/* Page anchor — scopes every zone. */}
      {availableMonths.length > 0 && (
        <div className="mb-4">
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
        displayMonth && (
          <TrackerZones
            month={displayMonth}
            total={totalBudget}
            categories={data?.categories ?? []}
            visibleCategories={visibleCategories}
            highlightTagId={highlightTagId}
            onEdit={handleEdit}
          />
        )
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

interface TrackerZonesProps {
  month: string;
  total: BudgetCategory | null;
  categories: BudgetCategory[];
  visibleCategories: BudgetCategory[];
  highlightTagId: number | null;
  onEdit: (c: BudgetCategory) => void;
}

// The loaded page body — the three zones. The categories section owns the
// scroll target so Zone 1's "+N more →" can jump to it.
function TrackerZones({
  month,
  total,
  categories,
  visibleCategories,
  highlightTagId,
  onEdit,
}: TrackerZonesProps) {
  const categoriesRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col gap-4">
      <ExpenseOverviewCard
        month={month}
        total={total}
        categories={categories}
        onEditTotal={onEdit}
        onSeeCategories={() =>
          categoriesRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      />
      <SpendTrendCard
        month={month}
        rolling={{
          avg: total?.avg_net_expense ?? null,
          min: total?.min_net_expense ?? null,
          max: total?.max_net_expense ?? null,
        }}
      />
      <CategoriesSection
        sectionRef={categoriesRef}
        month={month}
        visibleCategories={visibleCategories}
        highlightTagId={highlightTagId}
        onEdit={onEdit}
      />
    </div>
  );
}

interface CategoriesSectionProps {
  sectionRef: React.Ref<HTMLDivElement>;
  month: string;
  visibleCategories: BudgetCategory[];
  highlightTagId: number | null;
  onEdit: (c: BudgetCategory) => void;
}

function CategoriesSection({
  sectionRef,
  month,
  visibleCategories,
  highlightTagId,
  onEdit,
}: CategoriesSectionProps) {
  return (
    <section
      ref={sectionRef}
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
          No categorized spending found for {formatYearMonth(month, 'long')}.
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
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}
