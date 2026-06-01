// React-query keys for the recurring feature (BE Phase 1.5, `f369ce2`).
//
// Three read endpoints share the `recurring` namespace: the template
// list (active + inactive), `/upcoming?days=N` forecast rows, and
// `/history?days=N` settled rows. Mutations invalidate `templates` +
// the `upcoming`/`history` windows so a Confirm / Edit / Dismiss flow
// immediately reflows the dashboard widget + the /recurring tabs.
export const recurringKeys = {
  all: ['recurring'] as const,
  templates: () => [...recurringKeys.all, 'templates'] as const,
  upcoming: (days: number) => [...recurringKeys.all, 'upcoming', days] as const,
  history: (days: number) => [...recurringKeys.all, 'history', days] as const,
} as const;
