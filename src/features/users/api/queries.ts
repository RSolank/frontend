import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

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

// Stats shape for the Profile page's <UserStatsCard />. Backend
// shipped this at `GET /api/users/me/stats` in Phase 1.15 (`1e05a17`)
// per `task-platform.md → users.me-stats`. Two BE-reframed semantics
// vs the original spec worth knowing for the card copy:
// - `last_active_at` = `MAX(user_sessions.last_modified)` (reframed
//   from "last edit", which was unimplementable).
// - `total_beneficiaries` counts user-added only (the ~21 seeded
//   demo merchants + Self are excluded), so a brand-new account
//   shows 0.
// - `active_recurring` = templates currently forecasting (active +
//   locked/review). Always present now that T-recurring shipped.
export interface UserStatsResponse {
  joined_at: string;
  last_active_at: string | null;
  total_transactions: number;
  total_budgets: number;
  total_beneficiaries: number;
  active_recurring: number;
}

export function fetchCurrentUser(): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>(routes.users.me());
}

export function fetchUserPreferences(): Promise<PreferencesResponse> {
  return apiFetch<PreferencesResponse>(routes.users.preferences());
}

export function fetchRecoveryQuestions(): Promise<RecoveryListResponse> {
  return apiFetch<RecoveryListResponse>(routes.auth.recovery());
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

export function fetchUserStats(): Promise<UserStatsResponse> {
  return apiFetch<UserStatsResponse>(routes.users.meStats());
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
