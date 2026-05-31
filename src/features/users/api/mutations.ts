import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

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
