import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { EmailChangeForm } from './EmailChangeForm';

async function fillStep1(newEmail = 'new@example.test', password = 'pw') {
  fireEvent.change(screen.getByLabelText(/New email/), {
    target: { value: newEmail },
  });
  fireEvent.change(screen.getByLabelText(/Current password/), {
    target: { value: password },
  });
}

describe('EmailChangeForm', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('runs the happy-path two-step flow and shows the sign-out-other-devices notice', async () => {
    renderWithProviders(<EmailChangeForm />);
    await fillStep1();
    fireEvent.click(screen.getByTestId('email-change-request-submit'));

    // Step 2 — confirm panel renders with the target address.
    await waitFor(() =>
      expect(screen.getByTestId('email-change-confirm')).toBeInTheDocument()
    );
    expect(screen.getByText(/new@example\.test/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/One-time code/), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('email-change-confirm-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('email-change-done')).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Your other devices were signed out/)
    ).toBeInTheDocument();
  });

  it('reveals the 2FA code field on the first 401 with defensive copy', async () => {
    server.use(
      http.post(`${API_BASE}/auth/change-email-request`, () =>
        HttpResponse.json({ detail: 'Auth failed' }, { status: 401 })
      )
    );

    renderWithProviders(<EmailChangeForm />);
    await fillStep1();
    fireEvent.click(screen.getByTestId('email-change-request-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('email-change-2fa-code')).toBeInTheDocument()
    );
    expect(
      screen.getByRole('alert')
    ).toHaveTextContent(/two-factor on, enter your TOTP/);
  });

  it('surfaces 409 (email taken) inline on step 1', async () => {
    server.use(
      http.post(`${API_BASE}/auth/change-email-request`, () =>
        HttpResponse.json({ detail: 'Taken' }, { status: 409 })
      )
    );

    renderWithProviders(<EmailChangeForm />);
    await fillStep1();
    fireEvent.click(screen.getByTestId('email-change-request-submit'));

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(/already in use/);
  });

  it('treats 409 on confirm as terminal — restarts from step 1', async () => {
    server.use(
      http.post(`${API_BASE}/auth/change-email-confirm`, () =>
        HttpResponse.json({ detail: 'Taken' }, { status: 409 })
      )
    );

    renderWithProviders(<EmailChangeForm />);
    await fillStep1();
    fireEvent.click(screen.getByTestId('email-change-request-submit'));

    await screen.findByTestId('email-change-confirm');
    fireEvent.change(screen.getByLabelText(/One-time code/), {
      target: { value: '999999' },
    });
    fireEvent.click(screen.getByTestId('email-change-confirm-submit'));

    // Confirm view is gone; we're back at step 1 with the restart message.
    await waitFor(() => {
      expect(screen.getByTestId('email-change-request')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /claimed by someone else/
    );
  });
});
