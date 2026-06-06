import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { ResetZone } from './ResetZone';

describe('ResetZone', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renders the warning-tone Reset zone card with the trigger button', () => {
    renderWithProviders(<ResetZone />);
    expect(
      screen.getByRole('heading', { name: 'Reset zone' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('reset-zone-trigger')).toBeInTheDocument();
  });

  it('opens the password confirm modal when the trigger is clicked', async () => {
    renderWithProviders(<ResetZone />);
    fireEvent.click(screen.getByTestId('reset-zone-trigger'));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Reset your data' })
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it('on success closes the modal, shows the inline status, and posts the password', async () => {
    let postedBody: { password?: string } | null = null;
    server.use(
      http.post(`${API_BASE}/users/me/data-reset`, async ({ request }) => {
        postedBody = (await request.json()) as { password?: string };
        return HttpResponse.json({
          joined_at: '2026-01-15T08:30:00Z',
          last_active_at: null,
          total_transactions: 0,
          total_budgets: 0,
          total_beneficiaries: 0,
          active_recurring: 0,
        });
      })
    );

    renderWithProviders(<ResetZone />);
    await userEvent.click(screen.getByTestId('reset-zone-trigger'));
    await screen.findByRole('heading', { name: 'Reset your data' });
    await userEvent.type(screen.getByLabelText(/Password/i), 'hunter2');
    await userEvent.click(screen.getByTestId('reset-zone-confirm'));

    await waitFor(() => expect(postedBody).not.toBeNull());
    expect(postedBody).toEqual({ password: 'hunter2' });

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Reset your data' })
      ).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('reset-zone-status')).toHaveTextContent(
      /Your data was reset\. Starting fresh\./
    );
  });

  it('surfaces "Incorrect password" inline when the BE returns 403', async () => {
    server.use(
      http.post(`${API_BASE}/users/me/data-reset`, () =>
        HttpResponse.json({ detail: 'Wrong password' }, { status: 403 })
      )
    );

    renderWithProviders(<ResetZone />);
    await userEvent.click(screen.getByTestId('reset-zone-trigger'));
    await screen.findByRole('heading', { name: 'Reset your data' });
    await userEvent.type(screen.getByLabelText(/Password/i), 'whatever');
    await userEvent.click(screen.getByTestId('reset-zone-confirm'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Incorrect password/
    );
    // Modal stays open on error so the user can retry.
    expect(
      screen.getByRole('heading', { name: 'Reset your data' })
    ).toBeInTheDocument();
  });
});
