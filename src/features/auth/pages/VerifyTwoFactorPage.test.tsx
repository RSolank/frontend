import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { VerifyTwoFactorPage } from './VerifyTwoFactorPage';

function clearAuth() {
  useAuthStore.setState({ user: null, loading: false, error: null });
  localStorage.clear();
}

describe('<VerifyTwoFactorPage>', () => {
  it('redirects to /login when reached without a pending_token', () => {
    clearAuth();
    renderWithProviders(<VerifyTwoFactorPage />, {
      initialEntries: ['/verify/2fa'],
    });
    // Navigate replaces the entry; the form never renders.
    expect(screen.queryByTestId('verify-2fa-code-input')).not.toBeInTheDocument();
  });

  it('submits the code to /2fa/login-verify and persists tokens on success', async () => {
    clearAuth();
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(
        `${API_BASE}/auth/2fa/login-verify`,
        async ({ request }) => {
          seenBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            access_token: 'verified-a',
            refresh_token: 'verified-r',
          });
        }
      ),
      http.get(`${API_BASE}/users/me`, () =>
        HttpResponse.json({ user: { user_id: 1, email_id: 'a@b' } })
      ),
      http.get(`${API_BASE}/users/preferences`, () =>
        HttpResponse.json({})
      )
    );

    renderWithProviders(<VerifyTwoFactorPage />, {
      initialEntries: [
        { pathname: '/verify/2fa', state: { pending_token: 'pend-1' } },
      ],
    });

    fireEvent.change(screen.getByTestId('verify-2fa-code-input'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('verify-2fa-submit'));

    await waitFor(() =>
      expect(localStorage.getItem('access_token')).toBe('verified-a')
    );
    expect(seenBody).toEqual({ pending_token: 'pend-1', code: '123456' });
  });
});
