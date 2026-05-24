import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';

import { RegisterPage } from './RegisterPage';

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function resetStores() {
  useAuthStore.setState({
    user: null,
    constants: null,
    loading: false,
    error: null,
  });
  usePreferencesStore.getState().reset();
  localStorage.clear();
}

describe('RegisterPage', () => {
  beforeEach(() => {
    resetStores();
    // Pin the locale so the country default is deterministic across
    // CI runners (happy-dom defaults to en-US otherwise).
    Object.defineProperty(navigator, 'language', {
      value: 'en-IN',
      configurable: true,
    });
  });

  it('renders required register fields and defaults country from MSW metadata', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue('India')).toBeInTheDocument()
    );

    expect(
      screen.getByText('Register', { selector: 'h1' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last name/)).toBeInTheDocument();
    // Timezone field present + populated.
    expect(screen.getByLabelText(/^Timezone/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Asia/Kolkata')).toBeInTheDocument();
  });

  it('submits with timezone included in the payload', async () => {
    let captured: unknown = null;
    const { server } = await import('../../../test/server');
    const { http, HttpResponse } = await import('msw');
    server.use(
      http.post(
        'http://localhost:4000/api/auth/register',
        async ({ request }) => {
          captured = await request.json();
          return HttpResponse.json({
            access_token: 'msw-access',
            refresh_token: 'msw-refresh',
            user_id: 99,
            email_id: 'user@example.test',
            first_name: 'John',
            last_name: 'Doe',
          });
        }
      )
    );

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('India')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/First name/), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/Last name/), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'user@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'SecurePass123!' },
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Register' }));
    });

    await waitFor(() => {
      expect(captured).toMatchObject({
        email_id: 'user@example.test',
        first_name: 'John',
        last_name: 'Doe',
        password: 'SecurePass123!',
        timezone: 'Asia/Kolkata',
        country: 'India',
        currency: 'INR',
      });
    });
  });

  it('disables submit while password fails the validation rules', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('India')).toBeInTheDocument()
    );

    const passwordInput = screen.getByLabelText(/Password/);
    const submit = screen.getByRole('button', { name: 'Register' });

    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    expect(screen.getByText(/Password must have:/)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    expect(submit).not.toBeDisabled();
  });
});
