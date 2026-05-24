import { apiFetch } from '../../../shared/api/apiClient';

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
  return apiFetch<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function registerRequest(
  payload: RegisterPayload
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutRequest(): Promise<unknown> {
  return apiFetch<unknown>('/api/auth/logout', { method: 'POST' });
}

export interface RecoveryQuestionResponse {
  question?: string | null;
}

export function recoveryQuestionRequest(
  email_id: string
): Promise<RecoveryQuestionResponse> {
  return apiFetch<RecoveryQuestionResponse>('/api/auth/recovery-question', {
    method: 'POST',
    body: JSON.stringify({ email_id }),
  });
}

export function forgotPasswordRequest(email_id: string): Promise<unknown> {
  return apiFetch<unknown>('/api/auth/forgot-password', {
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
  return apiFetch<ResetTokenResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email_id, otp }),
  });
}

export function verifyAnswerRequest(
  email_id: string,
  answer: string
): Promise<ResetTokenResponse> {
  return apiFetch<ResetTokenResponse>('/api/auth/verify-answer', {
    method: 'POST',
    body: JSON.stringify({ email_id, answer }),
  });
}

export function resetPasswordFinalRequest(
  reset_token: string,
  new_password: string
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/api/auth/reset-password-final', {
    method: 'POST',
    body: JSON.stringify({ reset_token, new_password }),
  });
}
