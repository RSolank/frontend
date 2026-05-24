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
];
