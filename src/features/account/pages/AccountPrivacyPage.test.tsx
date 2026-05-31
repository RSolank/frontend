import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AccountPrivacyPage } from './AccountPrivacyPage';

describe('AccountPrivacyPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renders the Danger Zone card + the Privacy controls card', () => {
    renderWithProviders(<AccountPrivacyPage />);
    expect(
      screen.getByRole('heading', { name: 'Privacy controls' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Danger zone' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Accessibility' })
    ).toHaveAttribute('href', '/account/accessibility');
    expect(screen.getByTestId('danger-zone-delete')).toBeInTheDocument();
  });

  it('opens the password confirm modal when Delete account is clicked', async () => {
    renderWithProviders(<AccountPrivacyPage />);
    fireEvent.click(screen.getByTestId('danger-zone-delete'));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Delete account' })
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it('surfaces "Incorrect password" inline when the BE returns 403', async () => {
    server.use(
      http.post('http://localhost:4000/api/users/me/delete', () =>
        HttpResponse.json({ detail: 'Wrong password' }, { status: 403 })
      )
    );

    renderWithProviders(<AccountPrivacyPage />);
    fireEvent.click(screen.getByTestId('danger-zone-delete'));

    await screen.findByRole('heading', { name: 'Delete account' });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'whatever' },
    });
    fireEvent.click(screen.getByTestId('danger-zone-confirm'));

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(/Incorrect password/);
  });
});
