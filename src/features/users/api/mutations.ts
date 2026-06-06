import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { UserStatsResponse } from './queries';
import type {
  ChangePasswordInput,
  PreferencesUpdatePayload,
  ProfileUpdatePayload,
  SetRecoveryQuestionInput,
} from './schemas';

export function updateProfileRequest(
  payload: ProfileUpdatePayload
): Promise<unknown> {
  return apiFetch<unknown>(routes.users.me(), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updatePreferencesRequest(
  payload: PreferencesUpdatePayload
): Promise<unknown> {
  return apiFetch<unknown>(routes.users.preferences(), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function changePasswordRequest(
  payload: ChangePasswordInput
): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.changePassword(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function setRecoveryQuestionRequest(
  payload: SetRecoveryQuestionInput
): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.recovery(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// BE Phase 1.13 — set a shared geometric preset as the user's
// profile image. Returns the `{user: ...}` envelope; callers
// invalidate `userKeys.me()` to propagate the new
// `profile_image_url` everywhere.
export function setProfileImagePresetRequest(
  preset_id: string
): Promise<unknown> {
  return apiFetch<unknown>(routes.users.profileImagePreset(), {
    method: 'PUT',
    body: JSON.stringify({ preset_id }),
  });
}

// BE Phase 1.13 — multipart upload. Backend re-encodes to a 512px
// WEBP and returns the new URL. NOTE: apiClient sets
// `Content-Type: application/json` by default but skips it for
// FormData bodies; multipart-boundary is added by the browser.
export function uploadProfileImageRequest(file: File): Promise<unknown> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<unknown>(routes.users.profileImage(), {
    method: 'POST',
    body: form,
  });
}

// BE Phase 1.13 — idempotent 204. Reverts the user's
// `profile_image_url` to `null` (back to initials).
export function removeProfileImageRequest(): Promise<unknown> {
  return apiFetch<unknown>(routes.users.profileImage(), {
    method: 'DELETE',
  });
}

// BE Phase 2.1 — two-phase soft delete. Requires the user's
// password (BE 403 wrong password). On success the BE invalidates
// every session, so the FE caller must clear tokens + redirect.
export interface DeleteAccountResponse {
  detail?: string;
  grace_days?: number;
}

export function deleteAccountRequest(
  password: string
): Promise<DeleteAccountResponse> {
  return apiFetch<DeleteAccountResponse>(routes.users.delete(), {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

// BE Phase 2.1 — unauthenticated, takes the emailed token. 200 on
// reactivation; 400 bad/expired token; 410 already purged. The FE
// /account/cancel-deletion route translates each into a UI state.
export function cancelDeletionRequest(token: string): Promise<unknown> {
  return apiFetch<unknown>(routes.users.deleteCancel(), {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// BE Phase 2.15 — clean restart: wipes every domain row the user
// owns (transactions, beneficiaries, tags, budgets, recurring,
// taxation, statement jobs, activity, bank accounts), re-seeds
// registration defaults, and preserves identity, credentials,
// preferences, and the current session. 403 wrong password. The
// 200 body is the post-reset stats snapshot — caller seeds it into
// the stats query so the Profile card flips to zeros instantly.
export function resetMyDataRequest(
  password: string
): Promise<UserStatsResponse> {
  return apiFetch<UserStatsResponse>(routes.users.dataReset(), {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}
