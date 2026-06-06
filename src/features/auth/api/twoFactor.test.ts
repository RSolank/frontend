import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { server } from '../../../test/server';

import { isNewDeviceChallenge, isTwoFactorChallenge } from './mutations';
import {
  disableTwoFactorRequest,
  enrollTwoFactorRequest,
  loginVerifyTwoFactorRequest,
  verifyEnrollTwoFactorRequest,
} from './twoFactor';

describe('twoFactor api surface', () => {
  it('enrollTwoFactorRequest returns secret + provisioning URI + enroll_token', async () => {
    const res = await enrollTwoFactorRequest();
    expect(res.secret).toBeTruthy();
    expect(res.provisioning_uri).toContain('otpauth://');
    // Stateless staging (2026-06-06 BE update) — the JWT carrying the
    // encrypted staged secret rides on the response now.
    expect(res.enroll_token).toBeTruthy();
  });

  it('verifyEnrollTwoFactorRequest forwards enroll_token + code, returns 10 backup codes', async () => {
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/auth/2fa/verify-enroll`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          backup_codes: Array.from({ length: 10 }, (_, i) => `bc-${i}`),
        });
      })
    );
    const res = await verifyEnrollTwoFactorRequest('eyJ-token', '123456');
    expect(seenBody).toEqual({ enroll_token: 'eyJ-token', code: '123456' });
    expect(res.backup_codes).toHaveLength(10);
  });

  it('disableTwoFactorRequest POSTs the password', async () => {
    let seenBody: { password?: string } | null = null;
    server.use(
      http.post(`${API_BASE}/auth/2fa/disable`, async ({ request }) => {
        seenBody = (await request.json()) as { password: string };
        return HttpResponse.json({ status: 'ok' });
      })
    );
    await disableTwoFactorRequest('pw-test');
    expect(seenBody).toEqual({ password: 'pw-test' });
  });

  it('loginVerifyTwoFactorRequest POSTs pending_token + code and returns tokens', async () => {
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/auth/2fa/login-verify`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          access_token: 'finalized',
          refresh_token: 'finalized-r',
        });
      })
    );
    const res = await loginVerifyTwoFactorRequest('pend-token', '123456');
    expect(seenBody).toEqual({ pending_token: 'pend-token', code: '123456' });
    expect(res.access_token).toBe('finalized');
  });
});

describe('login response discriminators', () => {
  it('isTwoFactorChallenge narrows on status', () => {
    expect(
      isTwoFactorChallenge({
        status: 'two_factor_required',
        pending_token: 'p',
      })
    ).toBe(true);
    expect(
      isTwoFactorChallenge({
        access_token: 'a',
        refresh_token: 'r',
      })
    ).toBe(false);
  });

  it('isNewDeviceChallenge narrows on status', () => {
    expect(
      isNewDeviceChallenge({
        status: 'new_device_verification_required',
        pending_token: 'p',
        masked_email: 'a@b',
      })
    ).toBe(true);
    expect(
      isNewDeviceChallenge({
        status: 'two_factor_required',
        pending_token: 'p',
      })
    ).toBe(false);
  });
});
