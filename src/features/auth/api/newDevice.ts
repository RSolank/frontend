import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type {
  NewDeviceChallenge,
  TokenResponse,
  TwoFactorRequiredChallenge,
} from './mutations';

// BE Phase 2.3 (`f4b34d4`, T-new-device-otp) — emailed-OTP challenge
// for unknown-device logins + trusted-device management.

// The verify endpoint returns EITHER a real TokenResponse OR a 2FA
// challenge (when the user has 2FA on, the new-device gate is just
// step 1). It NEVER returns another new-device challenge — the
// device is already trusted by the time verify resolves
// successfully. The tighter union vs `LoginResponse` lets call
// sites narrow with `isTwoFactorChallenge` and treat the negative
// case as `TokenResponse` directly.
export type VerifyNewDeviceResponse =
  | TokenResponse
  | TwoFactorRequiredChallenge;

export function verifyNewDeviceRequest(
  pending_token: string,
  otp: string
): Promise<VerifyNewDeviceResponse> {
  return apiFetch<VerifyNewDeviceResponse>(routes.auth.newDeviceVerify(), {
    method: 'POST',
    body: JSON.stringify({ pending_token, otp }),
  });
}

// Re-issues a fresh OTP + a NEW pending_token. The FE swaps its
// `location.state.pending_token` with the returned one — the prior
// token is invalidated server-side.
export function resendNewDeviceOtpRequest(
  pending_token: string
): Promise<NewDeviceChallenge> {
  return apiFetch<NewDeviceChallenge>(routes.auth.newDeviceResend(), {
    method: 'POST',
    body: JSON.stringify({ pending_token }),
  });
}

// Idempotent 204. Unauthenticated — backs the one-click revoke link
// from the new-device intimation email.
export function revokeNewDeviceRequest(token: string): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.newDeviceRevoke(), {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// BE Phase 2.3 — KnownDeviceInfo from `GET /api/auth/devices`. Pure
// inventory; no fingerprint hash exposed. `is_current` flags the
// device that the requesting JWT was minted from so the UI can
// label "This device" + warn before revoking it.
export interface KnownDevice {
  uid: number;
  label: string | null;
  first_seen: string;
  last_seen: string;
  is_current: boolean;
}

export function fetchKnownDevices(): Promise<KnownDevice[]> {
  return apiFetch<KnownDevice[]>(routes.auth.devices());
}

// `DELETE /api/auth/devices/:uid` (auth). Cascades the device's
// active session — that device re-verifies by OTP on next login.
export function revokeKnownDeviceRequest(uid: number): Promise<unknown> {
  return apiFetch<unknown>(routes.auth.deviceById(uid), {
    method: 'DELETE',
  });
}

// Re-export the TokenResponse alias so `useAuth.verifyNewDevice`
// has a single import for the success-branch type.
export type { TokenResponse };
