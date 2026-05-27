import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';

import { userKeys } from './keys';

export interface UserProfile {
  user_id: number;
  email_id: string;
  first_name?: string;
  last_name?: string;
  dob?: string | null;
  contact?: string | null;
  country?: string | null;
  currency?: string | null;
  timezone?: string | null;
  [key: string]: unknown;
}

export interface UserMeResponse {
  user: UserProfile;
}

export interface PreferencesResponse {
  currency?: string | null;
  country?: string | null;
  timezone?: string | null;
}

export interface RecoveryQuestionItem {
  question: string;
}

export interface RecoveryListResponse {
  questions: RecoveryQuestionItem[];
}

// Stats shape for the Profile page's <UserStatsCard /> placeholder.
// Backend ask: `.scratch/task-handoff-fe-to-be.md §5` (queued for
// Phase 0.5 / Phase 1). When it ships at GET /api/users/me/stats
// (or /api/v1/users/me/stats post-prefix-cutover), this is the shape
// the card expects — mirrors §5's documented payload.
export interface UserStatsResponse {
  joined_at: string; // ISO datetime, e.g. "2026-01-12T08:00:00Z".
  total_transactions: number;
  total_budgets: number;
  total_beneficiaries: number;
  // Optional — populated once the recurring infrastructure (§10) ships;
  // backend omits when the feature isn't live yet.
  active_recurring?: number;
  // ISO datetime of the most recent txn / budget edit. Optional so a
  // brand-new account with zero activity can return only counts.
  last_active_at?: string | null;
}

export function fetchCurrentUser(): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>('/api/users/me');
}

export function fetchUserPreferences(): Promise<PreferencesResponse> {
  return apiFetch<PreferencesResponse>('/api/users/preferences');
}

export function fetchRecoveryQuestions(): Promise<RecoveryListResponse> {
  return apiFetch<RecoveryListResponse>('/api/auth/recovery');
}

export function useCurrentUserQuery(enabled = true) {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: fetchCurrentUser,
    enabled,
  });
}

export function useUserPreferencesQuery(enabled = true) {
  return useQuery({
    queryKey: userKeys.preferences(),
    queryFn: fetchUserPreferences,
    enabled,
  });
}

// Returns null when the endpoint is not yet implemented (404 / 501) so
// the Profile card can render a friendly "Coming soon" state instead of
// surfacing a hard error. Same swallow pattern as the Tax Tracker
// current-week endpoint (see features/taxation/api/queries.ts).
export async function fetchUserStats(): Promise<UserStatsResponse | null> {
  try {
    return await apiFetch<UserStatsResponse>('/api/users/me/stats');
  } catch (err) {
    const e = err as { status?: number };
    if (e?.status === 404 || e?.status === 501) return null;
    throw err;
  }
}

export function useUserStatsQuery(enabled = true) {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: fetchUserStats,
    enabled,
    // Stats are slow-moving — counts change as the user uses the app
    // but the card is informational, not transactional. Keep cached
    // for 5 minutes.
    staleTime: 5 * 60_000,
  });
}
