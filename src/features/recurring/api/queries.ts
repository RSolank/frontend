import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { recurringKeys } from './keys';
import type { RecurringBill, RecurringTemplate } from './schemas';

// BE Phase 1.5 — `GET /api/recurring/templates`. Returns every template
// owned by the user (active + inactive, candidate + review + locked).
// The page filters by status / active client-side; the server-ordered
// list is left as-is.
export function fetchRecurringTemplates(): Promise<RecurringTemplate[]> {
  return apiFetch<RecurringTemplate[]>(routes.recurring.templates());
}

export function useRecurringTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: recurringKeys.templates(),
    queryFn: fetchRecurringTemplates,
    enabled,
    // The list itself only changes when the worker promotes a row
    // or the user mutates one; 60s keeps mounts cheap and explicit
    // invalidation on mutation handles the freshness contract.
    staleTime: 60_000,
  });
}

// `GET /api/recurring/upcoming?days=N` — forward-looking pending bills
// within `days` (clamped ≤ 90 server-side). Dashboard widget uses
// `days=7`; the /recurring "Upcoming" tab uses `days=30`.
export function fetchRecurringUpcoming(days: number): Promise<RecurringBill[]> {
  const sp = new URLSearchParams({ days: String(days) });
  return apiFetch<RecurringBill[]>(
    `${routes.recurring.upcoming()}?${sp.toString()}`
  );
}

export function useRecurringUpcomingQuery(days: number, enabled = true) {
  return useQuery({
    queryKey: recurringKeys.upcoming(days),
    queryFn: () => fetchRecurringUpcoming(days),
    enabled,
    staleTime: 60_000,
  });
}

// `GET /api/recurring/history?days=N` — backward-looking settled bills
// within `days` (clamped ≤ 30 server-side). Not consumed in Batch 11
// surfaces yet; exported so a future "What got reconciled this month"
// strip can pick it up without re-introducing the query function.
export function fetchRecurringHistory(days: number): Promise<RecurringBill[]> {
  const sp = new URLSearchParams({ days: String(days) });
  return apiFetch<RecurringBill[]>(
    `${routes.recurring.history()}?${sp.toString()}`
  );
}

export function useRecurringHistoryQuery(days: number, enabled = true) {
  return useQuery({
    queryKey: recurringKeys.history(days),
    queryFn: () => fetchRecurringHistory(days),
    enabled,
    staleTime: 60_000,
  });
}
