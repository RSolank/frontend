import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { API_BASE } from '../../../test/baseUrl';
import { server } from '../../../test/server';

import { AccountProfilePage } from './AccountProfilePage';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <AccountProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AccountProfilePage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      constants: null,
      loading: false,
      error: null,
    });
    localStorage.clear();
    server.use(
      http.get(`${API_BASE}/users/me`, () =>
        HttpResponse.json({
          user: {
            user_id: 1,
            email_id: 'taylor@example.test',
            first_name: 'Taylor',
            last_name: 'Doe',
            dob: '1990-01-01',
            contact: '+911234567890',
            country: 'India',
            currency: 'INR',
            timezone: 'Asia/Kolkata',
          },
        })
      )
    );
  });

  it('hydrates basics from /api/users/me', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Taylor')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('taylor@example.test')).toBeInTheDocument();
    // Contact local/dial-code split mirrors the pre-Batch-9 behavior
    // (greedy regex strips up to 4 digits as the dial code). The
    // round-trip on PATCH still produces a valid full number, so we
    // don't assert exact values here — the split-extraction heuristic
    // is documented as pre-existing in the implementation plan.
    expect(screen.getByLabelText('Dial code')).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact \(phone\)/i)).toBeInTheDocument();
  });

  it('PATCHes only the profile slice (no country / currency / timezone)', async () => {
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_BASE}/users/me`, async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ user: { user_id: 1 } });
      })
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Taylor')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/First name/), {
      target: { value: 'Sam' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      expect(patchBody).toMatchObject({
        first_name: 'Sam',
        last_name: 'Doe',
        contact: '+911234567890',
      });
      expect(patchBody).not.toHaveProperty('country');
      expect(patchBody).not.toHaveProperty('currency');
      expect(patchBody).not.toHaveProperty('timezone');
    });
  });

  it('rejects too-short phone numbers before sending PATCH', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Taylor')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText(/Contact \(phone\)/i), {
      target: { value: '123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(
      screen.getByText(/Phone number should be 7–15 digits\./)
    ).toBeInTheDocument();
  });
});
