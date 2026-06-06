import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { VerifyNewDevicePage } from './VerifyNewDevicePage';

function clearAuth() {
  useAuthStore.setState({ user: null, loading: false, error: null });
  localStorage.clear();
}

describe('<VerifyNewDevicePage>', () => {
  beforeEach(() => {
    clearAuth();
  });

  it('redirects to /login without a pending_token', () => {
    renderWithProviders(<VerifyNewDevicePage />, {
      initialEntries: ['/verify/new-device'],
    });
    expect(
      screen.queryByTestId('verify-device-otp-input')
    ).not.toBeInTheDocument();
  });

  it('submits OTP to /new-device/verify and persists tokens on success', async () => {
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/auth/new-device/verify`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          access_token: 'nd-a',
          refresh_token: 'nd-r',
        });
      }),
      http.get(`${API_BASE}/users/me`, () =>
        HttpResponse.json({ user: { user_id: 1, email_id: 'a@b' } })
      ),
      http.get(`${API_BASE}/users/preferences`, () => HttpResponse.json({}))
    );

    renderWithProviders(<VerifyNewDevicePage />, {
      initialEntries: [
        {
          pathname: '/verify/new-device',
          state: { pending_token: 'pend-1', masked_email: 'a***@b' },
        },
      ],
    });

    fireEvent.change(screen.getByTestId('verify-device-otp-input'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByTestId('verify-device-submit'));

    await waitFor(() =>
      expect(localStorage.getItem('access_token')).toBe('nd-a')
    );
    expect(seenBody).toEqual({ pending_token: 'pend-1', otp: '654321' });
  });

  it('chains through to /verify/2fa when the BE returns a 2FA challenge', async () => {
    server.use(
      http.post(`${API_BASE}/auth/new-device/verify`, () =>
        HttpResponse.json({
          status: 'two_factor_required',
          pending_token: '2fa-pend-1',
        })
      )
    );

    renderWithProviders(<VerifyNewDevicePage />, {
      initialEntries: [
        {
          pathname: '/verify/new-device',
          state: { pending_token: 'pend-1', masked_email: 'a***@b' },
        },
      ],
    });

    fireEvent.change(screen.getByTestId('verify-device-otp-input'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByTestId('verify-device-submit'));

    // No token persisted; navigate took us to /verify/2fa
    await waitFor(() =>
      expect(localStorage.getItem('access_token')).toBeNull()
    );
  });

  it('resend issues a fresh challenge and updates the masked email', async () => {
    server.use(
      http.post(`${API_BASE}/auth/new-device/resend`, () =>
        HttpResponse.json({
          status: 'new_device_verification_required',
          pending_token: 'pend-NEW',
          masked_email: 'b***@example.com',
        })
      )
    );

    renderWithProviders(<VerifyNewDevicePage />, {
      initialEntries: [
        {
          pathname: '/verify/new-device',
          state: { pending_token: 'pend-OLD', masked_email: 'a***@b' },
        },
      ],
    });

    fireEvent.click(screen.getByTestId('verify-device-resend'));

    await waitFor(() =>
      expect(screen.getByText(/new code is on its way/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/b\*\*\*@example\.com/)).toBeInTheDocument();
  });
});
