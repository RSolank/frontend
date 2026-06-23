import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { userKeys } from './keys';

// `GET /api/users/me` returns identity only after BE Phase 1.9 —
// currency moved to `/api/users/preferences` (the new server SoT for
// preferences). Timezone follows the same logic; surface it from the
// preferences query, not from /me. `profile_image_url` is the BE
// Phase 1.13 single nullable field that carries `null` (initials),
// `/media/presets/<id>.webp`, or `/media/profile-images/<user>/<uuid>.webp`.
//
// 2FA state is intentionally NOT here — `UserAuth`-owned account
// protection lives on its own auth-domain route
// (`GET /api/v1/auth/security`, see `features/auth/api/security.ts`).
// Mixing it into `/me` would cross the profile/auth domain split.
// `role` (BE T-admin A1, `2c47fa9`) is a profile-domain authorization
// attribute and surfaces here so the FE admin gate reads it straight
// off the boot-time /me response instead of probing /admin/ping. The
// field is required server-side; older fixtures still ship without it
// for back-compat (treated as 'user' on consumer reads).
export interface UserProfile {
  user_id: number;
  email_id: string;
  first_name?: string;
  last_name?: string;
  dob?: string | null;
  contact?: string | null;
  country?: string | null;
  profile_image_url?: string | null;
  role?: 'user' | 'admin' | string;
  [key: string]: unknown;
}

export interface UserMeResponse {
  user: UserProfile;
}

// Server `user_preferences` row shape (flat) — the SoT for every
// cross-device user preference after BE Phase 1.9. Each key is
// optional + nullable because partial PATCHes leave unset rows null
// and the wire shape preserves that for forward-compat.
export interface PreferencesResponse {
  currency?: string | null;
  timezone?: string | null;
  date_format?: string | null;
  number_format?: string | null;
  landing_route?: string | null;
  default_txn_kind?: string | null;
  underline_links?: boolean | null;
  focus_ring_always?: boolean | null;
  // T-treasury — 3-state taxation mode. `auto`: the Monday worker
  // finalizes ACCRUING→BILLED on schedule; `manual`: bills stay
  // ACCRUING and the user drives generation via
  // `POST /consumption-tax/bills/generate`; `off`: the engine is
  // disabled (expense-tracker only). The stacking-defense worker flips
  // `auto`→`manual` when the unpaid-bill count crosses the threshold.
  tax_mode?: 'off' | 'manual' | 'auto' | null;
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

// BE Phase 1.13 — 12 shared geometric Pillow-rendered tiles served
// from `/media/presets/<id>.webp`. The `url` field is the path the
// FE feeds straight to `<ProfileImage profileImageUrl=...>` (or any
// `<img>` after prefixing with `VITE_API_URL`).
export interface ProfileImagePreset {
  id: string;
  url: string;
}

// BE returns a bare `list[ProfileImagePreset]` (see
// `backend/app/modules/users/user_routes.py` —
// `response_model=list[ProfileImagePreset]`). The previous wrapper
// `{presets?: [...]}` always resolved to `undefined.presets ?? []`,
// which is why the picker showed no presets until 2026-06-05.
export function fetchProfileImagePresets(): Promise<ProfileImagePreset[]> {
  return apiFetch<ProfileImagePreset[]>(routes.users.profileImagePresets());
}

export function useProfileImagePresetsQuery(enabled = true) {
  return useQuery({
    queryKey: userKeys.profileImagePresets(),
    queryFn: fetchProfileImagePresets,
    enabled,
    // Presets only change between deploys.
    staleTime: 60 * 60 * 1000,
  });
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
