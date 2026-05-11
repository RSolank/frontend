import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './Login';
import * as AuthContextModule from '../state/AuthContext';
import { describe, it, expect, vi } from 'vitest';

describe('Login Page', () => {
  it('renders login form properly', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      error: null,
      setError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Login', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
  });

  it('submits form elements correctly', async () => {
    const mockLogin = vi.fn().mockResolvedValue();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      error: null,
      setError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'pass123' } });
    
    const submitBtn = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email_id: 'user@example.com',
        password: 'pass123'
      });
    });
  });

  it('displays error from auth context', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      error: 'Invalid token or login',
      setError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Invalid token or login')).toBeInTheDocument();
  });
});
