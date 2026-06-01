import { http, HttpResponse } from 'msw';

// Auth-feature MSW handlers. Tests can override by calling
// `server.use(http.post(...))` to assert error paths.

export const authHandlers = [
  http.post('http://localhost:4000/api/auth/login', () =>
    HttpResponse.json({
      access_token: 'msw-access',
      refresh_token: 'msw-refresh',
    })
  ),
  http.post('http://localhost:4000/api/auth/register', () =>
    HttpResponse.json({
      access_token: 'msw-access',
      refresh_token: 'msw-refresh',
      user_id: 1,
      email_id: 'new@example.test',
      first_name: 'New',
      last_name: 'User',
    })
  ),
  http.post('http://localhost:4000/api/auth/logout', () =>
    HttpResponse.json({ status: 'ok' })
  ),
  http.post('http://localhost:4000/api/auth/recovery-question', () =>
    HttpResponse.json({ question: 'What city were you born in?' })
  ),
  http.post('http://localhost:4000/api/auth/forgot-password', () =>
    HttpResponse.json({ status: 'sent' })
  ),
  http.post('http://localhost:4000/api/auth/verify-otp', () =>
    HttpResponse.json({ reset_token: 'msw-reset-token' })
  ),
  http.post('http://localhost:4000/api/auth/verify-answer', () =>
    HttpResponse.json({ reset_token: 'msw-reset-token' })
  ),
  http.post('http://localhost:4000/api/auth/reset-password-final', () =>
    HttpResponse.json({ access_token: 'msw-access', refresh_token: 'msw-refresh' })
  ),
  http.post('http://localhost:4000/api/auth/change-password', () =>
    HttpResponse.json({ status: 'ok' })
  ),
  http.get('http://localhost:4000/api/auth/recovery', () =>
    HttpResponse.json({ questions: [] })
  ),
  http.post('http://localhost:4000/api/auth/recovery', () =>
    HttpResponse.json({ status: 'ok' })
  ),
  // Sessions list — empty by default; tests override with
  // `server.use(http.get('/api/auth/sessions', ...))` for richer data.
  http.get('http://localhost:4000/api/auth/sessions', () =>
    HttpResponse.json({ sessions: [] })
  ),
  // BE Phase 2.8 email-change — happy path defaults. Tests override
  // via `server.use(...)` to exercise 401/409/429/etc.
  http.post('http://localhost:4000/api/auth/change-email-request', () =>
    HttpResponse.json({ status: 'ok' })
  ),
  http.post('http://localhost:4000/api/auth/change-email-confirm', async ({ request }) => {
    await request.json();
    return HttpResponse.json({ status: 'ok', email: 'new@example.test' });
  }),
  // BE Phase 2.7 — 2FA endpoints. Tests override via `server.use(...)`
  // to assert failures (401 / 400 / 409) or the polymorphic login
  // challenge response (login returns `{status:"two_factor_required",
  // pending_token}` instead of TokenResponse when 2FA is enabled).
  http.post('http://localhost:4000/api/auth/2fa/enroll', () =>
    HttpResponse.json({
      secret: 'JBSWY3DPEHPK3PXP',
      provisioning_uri:
        'otpauth://totp/Personal%20Budget:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Personal%20Budget',
    })
  ),
  http.post('http://localhost:4000/api/auth/2fa/verify-enroll', () =>
    HttpResponse.json({
      backup_codes: [
        'ABCD1234',
        'EFGH5678',
        'IJKL9012',
        'MNOP3456',
        'QRST7890',
        'UVWX1234',
        'YZAB5678',
        'CDEF9012',
        'GHIJ3456',
        'KLMN7890',
      ],
    })
  ),
  http.post('http://localhost:4000/api/auth/2fa/disable', () =>
    HttpResponse.json({ status: 'ok' })
  ),
  http.post('http://localhost:4000/api/auth/2fa/login-verify', () =>
    HttpResponse.json({
      access_token: 'verified-access',
      refresh_token: 'verified-refresh',
      token_type: 'bearer',
    })
  ),
  // BE Phase 2.3 — new-device OTP + trusted-devices. Defaults:
  // verify resolves to a TokenResponse, resend issues a fresh
  // challenge shape, revoke is idempotent 204, devices list empty.
  // Tests override to exercise the 2FA chain-through, 400/429
  // failures, and a populated devices list.
  http.post('http://localhost:4000/api/auth/new-device/verify', () =>
    HttpResponse.json({
      access_token: 'nd-verified-access',
      refresh_token: 'nd-verified-refresh',
      token_type: 'bearer',
    })
  ),
  http.post('http://localhost:4000/api/auth/new-device/resend', () =>
    HttpResponse.json({
      status: 'new_device_verification_required',
      pending_token: 'pend-2',
      masked_email: 'a***@example.com',
    })
  ),
  http.post(
    'http://localhost:4000/api/auth/new-device/revoke',
    () => new HttpResponse(null, { status: 204 })
  ),
  http.get('http://localhost:4000/api/auth/devices', () =>
    HttpResponse.json([])
  ),
  http.delete(
    'http://localhost:4000/api/auth/devices/:uid',
    () => new HttpResponse(null, { status: 204 })
  ),
];
