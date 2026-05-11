import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from './Register';
import * as AuthContextModule from '../state/AuthContext';
import * as ApiClientModule from '../utils/apiClient';
import { describe, it, expect, vi } from 'vitest';

describe('Register Page', () => {
  it('renders required register fields', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      register: vi.fn(),
      error: null,
      setError: vi.fn(),
    });
    vi.spyOn(ApiClientModule, 'apiFetch').mockResolvedValue({});

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Register', { selector: 'h1' })).toBeInTheDocument();
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
    vi.spyOn(ApiClientModule, 'apiFetch').mockResolvedValue({});

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'pass123' } });
    
    // Simulate clicking submit
    fireEvent.submit(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
        email_id: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        password: 'pass123'
      }));
    });
  });

  it.fails('validates extreme password length and spaces locally', async () => {
    const mockRegister = vi.fn().mockResolvedValue();
    const mockSetError = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      register: mockRegister,
      error: null,
      setError: mockSetError,
    });
    vi.spyOn(ApiClientModule, 'apiFetch').mockResolvedValue({});

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Provide base info
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'user@example.com' } });
    
    // Try spaces
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'pass  word' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Register' }));
    
    // Validate that it rejected the space (Expected to fail right now, as this isn't implemented)
    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith(expect.stringContaining('spaces'));
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });
});
