import { useQuery } from '@tanstack/react-query';

import { activityKeys } from './activityKeys';
import { apiFetch } from './apiClient';
import { routes } from './routes';

// BE Phase 2.14 — `GET /api/v1/activity/catalog` returns the kind
// registry. Used to:
//   • split feed items into "Alerts" vs "Notifications" via
//     `event_class_of(kind)` (the BE doesn't filter by event_class
//     on the wire today; we do it client-side, single fetch).
//   • render the kind list + labels in the user Notifications tab
//     and the admin user-detail signal-settings section.
// `system_enabled === false` means the kind is globally off (admin
// only can re-enable); users see it as a disabled toggle.

export interface CatalogEntry {
  kind: string;
  event_class: 'alert' | 'notification' | string;
  domain: string;
  subject_type: string;
  priority: 1 | 2 | 3 | number;
  rank_order: number;
  system_enabled: boolean;
  collapse_threshold: number | null;
  collapse_label: string | null;
}

export interface CatalogResponse {
  entries: CatalogEntry[];
}

export function fetchActivityCatalog(): Promise<CatalogResponse> {
  return apiFetch<CatalogResponse>(routes.activity.catalog());
}

export function useActivityCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: activityKeys.catalog(),
    queryFn: fetchActivityCatalog,
    enabled,
    // Catalog is registry-driven (changes between deploys, not at
    // runtime). Cache aggressively.
    staleTime: 60 * 60 * 1000,
  });
}

// Build a fast lookup from kind → event_class. The bell modal walks
// feed items in BE order and uses this to bucket each into alerts /
// notifications without re-sorting.
export function buildEventClassIndex(
  catalog: CatalogResponse | undefined
): Map<string, CatalogEntry['event_class']> {
  const map = new Map<string, CatalogEntry['event_class']>();
  if (!catalog) return map;
  for (const e of catalog.entries) map.set(e.kind, e.event_class);
  return map;
}
