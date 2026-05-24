import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import * as AuthContextModule from '../../state/AuthContext';
import * as ApiClientModule from '../../shared/api/apiClient';

import { RegisterPage } from './Register';


describe('Register Page', () => {
  it('renders required register fields', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      register: vi.fn(),
      error: null,
      setError: vi.fn(),
    });
    vi.spyOn(ApiClientModule, 'apiFetch').mockResolvedValue({
      countries: [
        { name: 'India', country_code: '+91', default_currency: 'INR' },
      ],
      currencies: [{ code: 'INR', label: 'INR - Indian Rupee' }],
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
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
  });

  it('submits valid forms correctly', async () => {
    const mockRegister = vi.fn().mockResolvedValue();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      register: mockRegister,
      error: null,
      setError: vi.fn(),
    });
    vi.spyOn(ApiClientModule, 'apiFetch').mockResolvedValue({
      countries: [
        { name: 'India', country_code: '+91', default_currency: 'INR' },
      ],
      currencies: [{ code: 'INR', label: 'INR - Indian Rupee' }],
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
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
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'SecurePass123!' },
    });

    // Simulate clicking submit
    fireEvent.submit(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          email_id: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          password: 'SecurePass123!',
        })
      );
    });
  });

  it('validates password requirements and disables register button', async () => {
    const mockRegister = vi.fn().mockResolvedValue();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      register: mockRegister,
      error: null,
      setError: vi.fn(),
    });
    vi.spyOn(ApiClientModule, 'apiFetch').mockResolvedValue({
      countries: [
        { name: 'India', country_code: '+91', default_currency: 'INR' },
      ],
      currencies: [{ code: 'INR', label: 'INR - Indian Rupee' }],
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RegisterPage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('India')).toBeInTheDocument()
    );

    const passwordInput = screen.getByLabelText(/Password/);
    const registerBtn = screen.getByRole('button', { name: 'Register' });

    // Initial state: empty password, no requirements shown, button not disabled by validation but maybe by submitting
    expect(screen.queryByText(/Password must have:/)).not.toBeInTheDocument();

    // Type weak password
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    expect(screen.getByText(/Password must have:/)).toBeInTheDocument();
    expect(registerBtn).toBeDisabled();

    // Check individual requirements (some should be unmet)
    expect(
      screen.getByText('8-64 characters').previousSibling.textContent
    ).toBe('○');
    expect(
      screen.getByText('At least one uppercase letter').previousSibling
        .textContent
    ).toBe('○');

    // Type strong password
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    expect(registerBtn).not.toBeDisabled();
    expect(
      screen.getByText('8-64 characters').previousSibling.textContent
    ).toBe('✓');
    expect(
      screen.getByText('At least one uppercase letter').previousSibling
        .textContent
    ).toBe('✓');
    expect(
      screen.getByText('At least one special character').previousSibling
        .textContent
    ).toBe('✓');

    // Type password with spaces (should be trimmed and checked)
    fireEvent.change(passwordInput, { target: { value: '  Short1!  ' } });
    // "Short1!" is 7 characters. Trimmed length 7 is invalid.
    expect(
      screen.getByText('8-64 characters').previousSibling.textContent
    ).toBe('○');
    expect(registerBtn).toBeDisabled();
  });
});
