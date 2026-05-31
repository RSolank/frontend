import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { AdminLandingPage } from './AdminLandingPage';

describe('AdminLandingPage', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('renders the admin scaffold when the gate returns 200', async () => {
    server.use(
      http.get('http://localhost:4000/api/admin/ping', () =>
        HttpResponse.json({ status: 'ok', user_id: 1 })
      )
    );

    renderWithProviders(<AdminLandingPage />);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Admin tools' })
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/Access gate \(live\)/)).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/admin\/ping/)).toBeInTheDocument();
  });

  it('renders the "Not available" panel when the gate returns 403', async () => {
    // Default handler is 403, so no override needed.
    renderWithProviders(<AdminLandingPage />);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Not available' })
      ).toBeInTheDocument()
    );
    // No admin scaffold should render alongside the rejection.
    expect(
      screen.queryByRole('heading', { name: 'Admin tools' })
    ).not.toBeInTheDocument();
  });
});
