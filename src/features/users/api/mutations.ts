import { apiFetch } from '../../../shared/api/apiClient';

import type {
  ChangePasswordInput,
  ProfileUpdatePayload,
  SetRecoveryQuestionInput,
} from './schemas';

export function updateProfileRequest(
  payload: ProfileUpdatePayload
): Promise<unknown> {
  return apiFetch<unknown>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function changePasswordRequest(
  payload: ChangePasswordInput
): Promise<unknown> {
  return apiFetch<unknown>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function setRecoveryQuestionRequest(
  payload: SetRecoveryQuestionInput
): Promise<unknown> {
  return apiFetch<unknown>('/api/auth/recovery', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
