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

// BE Phase 2.7 — pending-login challenge when 2FA is enabled. Sent
// as a 200 OK (not an error), so the FE has to discriminate on the
// `status` field rather than catching an exception.
export interface TwoFactorRequiredChallenge {
  status: 'two_factor_required';
  pending_token: string;
}

// BE Phase 2.3 — pending-login challenge when the device is unknown.
// FE wiring is queued for Platform FE Batch 10 (`auth.new-device-otp`);
// recognized here so 2FA + new-device callers share the discriminator
// pattern instead of two divergent shapes.
export interface NewDeviceChallenge {
  status: 'new_device_verification_required';
  pending_token: string;
  masked_email?: string | null;
}

export type LoginResponse =
  | TokenResponse
  | TwoFactorRequiredChallenge
  | NewDeviceChallenge;

// Narrowing helpers — pinned to the discriminator so call sites
// read clean (`isTwoFactorChallenge(res)` vs `'status' in res`).
// Accept any object so subsets of `LoginResponse` (e.g.
// `VerifyNewDeviceResponse` = TokenResponse |
// TwoFactorRequiredChallenge) narrow without an upcast — TokenResponse
// has no `status` field at all, so we read defensively.
export function isTwoFactorChallenge<T extends object>(
  res: T
): res is T & TwoFactorRequiredChallenge {
  return (res as { status?: string }).status === 'two_factor_required';
}

export function isNewDeviceChallenge<T extends object>(
  res: T
): res is T & NewDeviceChallenge {
  return (
    (res as { status?: string }).status === 'new_device_verification_required'
  );
}

export function loginRequest(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>(routes.auth.login(), {
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

// BE Phase 2.7 — recovery reset is now polymorphic too. If the user
// has 2FA enabled, the BE saves the new password but returns the
// `two_factor_required` challenge instead of a TokenResponse —
// backup codes are the escape hatch when the authenticator is lost
// (recovery no longer bypasses 2FA).
export function resetPasswordFinalRequest(
  reset_token: string,
  new_password: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>(routes.auth.resetPasswordFinal(), {
    method: 'POST',
    body: JSON.stringify({ reset_token, new_password }),
  });
}

export function revokeSessionRequest(session_id: number): Promise<unknown> {
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
  return apiFetch<ChangeEmailConfirmResponse>(
    routes.auth.changeEmailConfirm(),
    {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }
  );
}
