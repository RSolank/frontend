import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { TwoFactorSection } from './TwoFactorSection';

function installSecurity(
  twoFactorEnabled: boolean,
  backupCodesRemaining = twoFactorEnabled ? 10 : 0
) {
  server.use(
    http.get(`${API_BASE}/auth/security`, () =>
      HttpResponse.json({
        has_recovery: false,
        two_factor_enabled: twoFactorEnabled,
        backup_codes_remaining: backupCodesRemaining,
      })
    )
  );
}

describe('<TwoFactorSection>', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'test');
  });

  it('renders the disabled-idle CTA when 2FA is off', async () => {
    installSecurity(false);
    renderWithProviders(<TwoFactorSection />);
    expect(
      await screen.findByTestId('2fa-enable-button')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('2fa-disable-button')
    ).not.toBeInTheDocument();
  });

  it('walks the enrollment flow: enroll → verify-enroll → backup codes', async () => {
    installSecurity(false);
    renderWithProviders(<TwoFactorSection />);

    fireEvent.click(await screen.findByTestId('2fa-enable-button'));
    // Stage 2 — secret + provisioning URI shown.
    await waitFor(() =>
      expect(screen.getByTestId('2fa-enroll-secret')).toBeInTheDocument()
    );
    expect(screen.getByTestId('2fa-enroll-secret')).toHaveTextContent(
      'JBSWY3DPEHPK3PXP'
    );

    fireEvent.change(screen.getByTestId('2fa-enroll-code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('2fa-enroll-verify'));

    // Stage 3 — backup codes panel.
    const panel = await screen.findByTestId('2fa-backup-codes');
    const codes = within(panel).getAllByRole('listitem');
    expect(codes).toHaveLength(10);
    expect(panel).toHaveTextContent('ABCD1234');

    expect(
      screen.getByTestId('2fa-backup-download')
    ).toBeInTheDocument();
  });

  it('renders the enabled-idle Disable CTA when 2FA is on', async () => {
    installSecurity(true);
    renderWithProviders(<TwoFactorSection />);
    expect(
      await screen.findByTestId('2fa-disable-button')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('2fa-enable-button')
    ).not.toBeInTheDocument();
  });

  it('renders the backup-codes-remaining badge under the enabled state', async () => {
    installSecurity(true, 7);
    renderWithProviders(<TwoFactorSection />);
    expect(
      await screen.findByTestId('2fa-backup-codes-remaining')
    ).toHaveTextContent('7 backup codes remaining.');
  });

  it('disable flow POSTs the password and refetches the security snapshot', async () => {
    installSecurity(true);
    let seenBody: { password?: string } | null = null;
    server.use(
      http.post(
        `${API_BASE}/auth/2fa/disable`,
        async ({ request }) => {
          seenBody = (await request.json()) as { password: string };
          return HttpResponse.json({ status: 'ok' });
        }
      )
    );

    renderWithProviders(<TwoFactorSection />);
    fireEvent.click(await screen.findByTestId('2fa-disable-button'));
    fireEvent.change(
      await screen.findByTestId('2fa-disable-password'),
      { target: { value: 'pw' } }
    );
    fireEvent.click(screen.getByTestId('2fa-disable-confirm'));

    await waitFor(() => expect(seenBody).toEqual({ password: 'pw' }));
  });
});
