import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../../shared/state/auth.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';

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
    renderWithProviders(
      <>
        <RegisterPage />
      </>
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue('(+91) India')).toBeInTheDocument()
    );

    expect(
      screen.getByText('Register', { selector: 'h1' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last name/)).toBeInTheDocument();
    // Timezone field present + populated. Batch 9.1 Q3: the read-only
    // display now appends the current UTC offset
    // ("Asia/Kolkata (UTC+5:30)") so the assertion matches either form.
    expect(screen.getByLabelText(/^Timezone/)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(/^Asia\/Kolkata(\s\(UTC.*\))?$/)
    ).toBeInTheDocument();
  });

  it('submits with timezone included in the payload', async () => {
    let captured: unknown = null;
    const { server } = await import('../../../test/server');
    const { http, HttpResponse } = await import('msw');
    server.use(
      http.post(
        `${API_BASE}/auth/register`,
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

    renderWithProviders(
      <>
        <RegisterPage />
      </>
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('(+91) India')).toBeInTheDocument()
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
      });
      // Currency was removed from the register payload after BE
      // Phase 1.9 — the backend derives it from `country` when seeding
      // the new `user_preferences` row.
      expect(captured).not.toHaveProperty('currency');
    });
  });

  // Locks the validateRegistration() branches extracted from handleSubmit in
  // Batch 10.11 round-2 (the useRegisterForm hook split). Each fills the
  // required fields with a valid password so submission reaches the
  // cross-field guard, then asserts the guard blocks it with its message.
  async function fillValidBase() {
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
  }

  it('blocks submit and shows an error when the phone number is too short', async () => {
    renderWithProviders(<RegisterPage />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('(+91) India')).toBeInTheDocument()
    );

    await fillValidBase();
    fireEvent.change(screen.getByPlaceholderText('Phone number (optional)'), {
      target: { value: '123' },
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Register' }));
    });

    expect(
      screen.getByText('Please enter a valid phone number.')
    ).toBeInTheDocument();
  });

  it('blocks submit when a security question is chosen without an answer', async () => {
    renderWithProviders(<RegisterPage />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('(+91) India')).toBeInTheDocument()
    );

    await fillValidBase();
    fireEvent.change(screen.getByLabelText(/Security question/), {
      target: { value: 'What was the name of your first pet?' },
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Register' }));
    });

    expect(
      screen.getByText(
        'Please provide an answer for the selected security question.'
      )
    ).toBeInTheDocument();
  });

  it('disables submit while password fails the validation rules', async () => {
    renderWithProviders(
      <>
        <RegisterPage />
      </>
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('(+91) India')).toBeInTheDocument()
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
