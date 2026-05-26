// Placeholder secondary widget for the cross-feature activity feed.
//
// A unified "activity log" (txns + budgets + bills + tag-rule edits
// + statement uploads) doesn't exist on the backend yet. Filed as
// a frontend request in `.scratch/task-handoff-fe-to-be.md §4`; the
// matching backend endpoint will land in a future phase. Until then
// this card holds the shape on the dashboard so the layout doesn't
// shift when the real data arrives.
//
// Per the Batch 8.5 design answer ("placeholder card with coming
// soon") this is intentionally inert — no fetch, no skeleton, no
// fake data. Once the endpoint lands the body swaps for a real list
// without disturbing the dashboard composition.
export function RecentActivityWidget() {
  return (
    <section
      data-testid="dashboard-activity-placeholder"
      className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
      aria-labelledby="activity-placeholder-heading"
    >
      <header className="mb-1">
        <h3
          id="activity-placeholder-heading"
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          Recent activity
        </h3>
      </header>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        A cross-feature activity feed (transactions, budgets, bills,
        tag changes) will appear here once the backend endpoint
        ships.
      </p>
    </section>
  );
}
