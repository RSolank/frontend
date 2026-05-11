import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { HomePage } from './Home';
import { useAuth } from '../state/AuthContext';

vi.mock('../state/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe('HomePage', () => {
  it('renders landing page content for unauthenticated users', () => {
    useAuth.mockReturnValue({ user: null });
    
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Smart budgeting for future you/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Log in/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Register/i)).toBeInTheDocument();
  });

  it('redirects authenticated users to dashboard', async () => {
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    useAuth.mockReturnValue({ user: { first_name: 'John' } });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });
});
