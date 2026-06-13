import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { activityKeys } from './activityKeys';
import { apiFetch } from './apiClient';
import { routes } from './routes';

// BE Phase 2.14 — `GET /api/v1/activity?limit=N&domain=<str>`.
//
// The feed returns a server-ranked list (by `value`, the decay /
// escalation score). **Preserve the BE order in the UI** — never
// re-sort client-side. The bell modal buckets items into alerts vs
// notifications via `catalog.event_class_of(kind)` but maintains BE
// order within each bucket (task-admin.md: "the first item on the
// feed is of the highest significance").

export interface ActivityFeedItem {
  uid: number;
  kind: string;
  event_class: 'alert' | 'notification' | string;
  domain: string;
  subject_type: string;
  subject_id: string;
  priority: 1 | 2 | 3 | number;
  state: string;
  summary: string;
  created_at: string;
  refreshed_at: string;
  aggregate_count: number;
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[];
  has_more: boolean;
}

export function fetchActivityFeed(
  limit: number
): Promise<ActivityFeedResponse> {
  const sp = new URLSearchParams({ limit: String(limit) });
  return apiFetch<ActivityFeedResponse>(
    `${routes.activity.feed()}?${sp.toString()}`
  );
}

export function useActivityFeedQuery(limit = 10, enabled = true) {
  return useQuery({
    queryKey: activityKeys.feed(limit),
    queryFn: () => fetchActivityFeed(limit),
    enabled,
    // 30s matches the old dashboard widget posture — the feed updates
    // on user events; this keeps the bell quiet while still surfacing
    // worker-originated events on the next focus/refetch cycle.
    staleTime: 30_000,
  });
}

// BE Phase 2.14 contract — `POST /activity/seen` now takes a list of
// `(kind, subject_type, subject_id)` triples and a single `hard`
// bool. (The 2.4 contract was `{events:[event_id], signal}`; this
// rewrite is part of the Batch 18 activity-refresh sweep.)
export interface ActivitySeenRef {
  kind: string;
  subject_type: string;
  subject_id: string;
}

export interface ActivitySeenRequest {
  refs: ActivitySeenRef[];
  hard: boolean;
}

export interface ActivitySeenResponse {
  affected: number;
}

export function markActivitySeen(
  payload: ActivitySeenRequest
): Promise<ActivitySeenResponse> {
  return apiFetch<ActivitySeenResponse>(routes.activity.seen(), {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  });
}

// Convenience helper: take feed items + the hard flag and fire one
// POST. Used by both soft-ack-on-modal-open (hard=false, all items)
// and hard-ack-on-click (hard=true, single item).
export function itemsToSeenRefs(items: ActivityFeedItem[]): ActivitySeenRef[] {
  return items.map((i) => ({
    kind: i.kind,
    subject_type: i.subject_type,
    subject_id: i.subject_id,
  }));
}

// `POST /activity/seen` is fire-and-forget from the FE perspective —
// the BE dedupes per cycle, and an error doesn't change the user
// experience. The mutation hook **invalidates the feed query on
// success** so a hard-ack click triggers an immediate refetch and
// the item drops out of the list. Soft-ack callers that don't want
// the refetch can keep using the standalone `markActivitySeen`
// helper (it skips the cache entirely).
export function useMarkActivitySeenMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markActivitySeen,
    onSuccess: (_data, variables) => {
      // Only invalidate on hard-ack: soft-ack changes BE state
      // (last_seen_at) but doesn't drop items from the feed, so
      // re-fetching produces the same list and just wastes a round
      // trip while the modal is open.
      if (variables.hard) {
        void qc.invalidateQueries({ queryKey: activityKeys.feedAll() });
      }
    },
  });
}

// User-side signal-settings — drives the Notifications tab.
export interface SignalSettingsResponse {
  disabled: string[];
}

export interface SignalSettingsUpdate {
  kind: string;
  enabled: boolean;
}

export function fetchUserSignalSettings(): Promise<SignalSettingsResponse> {
  return apiFetch<SignalSettingsResponse>(routes.activity.signalSettings());
}

export function updateUserSignalSetting(
  body: SignalSettingsUpdate
): Promise<SignalSettingsResponse> {
  return apiFetch<SignalSettingsResponse>(routes.activity.signalSettings(), {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

export function useUserSignalSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: activityKeys.signalSettings(),
    queryFn: fetchUserSignalSettings,
    enabled,
    staleTime: 60_000,
  });
}
