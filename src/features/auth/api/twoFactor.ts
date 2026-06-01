import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { TokenResponse } from './mutations';

// BE Phase 2.7 (`531f9c7`, T-2fa-enroll) — TOTP 2FA wire contract.
// Functional, RFC-6238. The secret is encrypted at rest server-side
// (Fernet); the FE only sees it ONCE at enrollment for the QR + the
// manual-entry fallback.

export interface TwoFactorEnrollResponse {
  // Base32 shared secret. Shown once for manual-entry fallback.
  secret: string;
  // `otpauth://totp/...` URI. FE renders this as a QR code.
  provisioning_uri: string;
}

export interface TwoFactorVerifyEnrollResponse {
  // 10 one-time backup codes. Returned ONCE (display + download
  // offer). Only hashes are stored — no regenerate endpoint.
  backup_codes: string[];
}

// BE Phase 2.7 — pending-login challenge when a 2FA-enabled user
// clears the password (and any new-device) gate. The FE collects a
// TOTP / backup code and POSTs `/2fa/login-verify`.
export interface TwoFactorChallengeResponse {
  status: 'two_factor_required';
  pending_token: string;
}

export function enrollTwoFactorRequest(): Promise<TwoFactorEnrollResponse> {
  return apiFetch<TwoFactorEnrollResponse>(routes.auth.twoFactorEnroll(), {
    method: 'POST',
  });
}

export function verifyEnrollTwoFactorRequest(
  code: string
): Promise<TwoFactorVerifyEnrollResponse> {
  return apiFetch<TwoFactorVerifyEnrollResponse>(
    routes.auth.twoFactorVerifyEnroll(),
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    }
  );
}

export function disableTwoFactorRequest(
  password: string
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(routes.auth.twoFactorDisable(), {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

// Login-verify accepts a 6-digit TOTP OR an 8-char base32 backup code
// (lenient: case + spaces + hyphens stripped server-side). Returns
// the standard TokenResponse + sets the `auth_token` cookie.
export function loginVerifyTwoFactorRequest(
  pending_token: string,
  code: string
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(routes.auth.twoFactorLoginVerify(), {
    method: 'POST',
    body: JSON.stringify({ pending_token, code }),
  });
}
