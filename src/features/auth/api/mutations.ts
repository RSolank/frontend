import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { LoginInput, RegisterPayload } from './schemas';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user_id?: number;
  email_id?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

export function loginRequest(input: LoginInput): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(routes.auth.login(), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function registerRequest(
  payload: RegisterPayload
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(routes.auth.register(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutRequest(): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.logout(), { method: 'POST' });
}

export interface RecoveryQuestionResponse {
  question?: string | null;
}

export function recoveryQuestionRequest(
  email_id: string
): Promise<RecoveryQuestionResponse> {
  return apiFetch<RecoveryQuestionResponse>(routes.auth.recoveryQuestion(), {
    method: 'POST',
    body: JSON.stringify({ email_id }),
  });
}

export function forgotPasswordRequest(email_id: string): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.forgotPassword(), {
    method: 'POST',
    body: JSON.stringify({ email_id }),
  });
}

interface ResetTokenResponse {
  reset_token: string;
}

export function verifyOtpRequest(
  email_id: string,
  otp: string
): Promise<ResetTokenResponse> {
  return apiFetch<ResetTokenResponse>(routes.auth.verifyOtp(), {
    method: 'POST',
    body: JSON.stringify({ email_id, otp }),
  });
}

export function verifyAnswerRequest(
  email_id: string,
  answer: string
): Promise<ResetTokenResponse> {
  return apiFetch<ResetTokenResponse>(routes.auth.verifyAnswer(), {
    method: 'POST',
    body: JSON.stringify({ email_id, answer }),
  });
}

export function resetPasswordFinalRequest(
  reset_token: string,
  new_password: string
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(routes.auth.resetPasswordFinal(), {
    method: 'POST',
    body: JSON.stringify({ reset_token, new_password }),
  });
}

export function revokeSessionRequest(
  session_id: number
): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.sessionById(session_id), {
    method: 'DELETE',
  });
}

// BE Phase 2.8 — authenticated email change. `code` is required
// when the user has 2FA on; FE omits it initially and reveals the
// field on a 401 (the BE response disambiguates wrong-password vs
// missing-code only via the front-channel "did 2FA fail?" hint).
export interface ChangeEmailRequestPayload {
  new_email: string;
  password: string;
  code?: string;
}

export function changeEmailRequestStart(
  payload: ChangeEmailRequestPayload
): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.changeEmailRequest(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface ChangeEmailConfirmResponse {
  status?: string;
  email?: string;
}

export function changeEmailConfirmRequest(
  otp: string
): Promise<ChangeEmailConfirmResponse> {
  return apiFetch<ChangeEmailConfirmResponse>(routes.auth.changeEmailConfirm(), {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}
