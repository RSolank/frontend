import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from './ProfilePage';
import { apiFetch } from '../../utils/apiClient';

vi.mock('../../utils/apiClient.js', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../../state/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: {
      first_name: 'John',
      last_name: 'Doe',
      email_id: 'john@example.com',
      dob: '1990-01-01',
      contact: '1234567890',
      country: 'USA',
      currency: 'USD'
    },
    refreshUser: vi.fn()
  })
}));

const mockOptionsResponse = {
  countries: [{ name: 'USA', country_code: '+1', default_currency: 'USD' }],
  currencies: [{ code: 'USD', label: 'USD - US Dollar' }]
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders profile data and allows editing', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/users/me') return { user: { first_name: 'John', last_name: 'Doe' } };
      if (url === '/api/metadata/countries') return { countries: mockOptionsResponse.countries };
      if (url === '/api/metadata/currencies') return { currencies: mockOptionsResponse.currencies };
      if (url === '/api/auth/recovery') return { questions: [] };
      return {};
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Jane' } });
    
    // Mock the PATCH call
    apiFetch.mockResolvedValueOnce({ user: { first_name: 'Jane' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"first_name":"Jane"')
      }));
    });
  });

  it('validates new password requirements in settings', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/users/me') return { user: { first_name: 'John', last_name: 'Doe' } };
      if (url === '/api/metadata/countries') return { countries: mockOptionsResponse.countries };
      if (url === '/api/metadata/currencies') return { currencies: mockOptionsResponse.currencies };
      if (url === '/api/auth/recovery') return { questions: [] };
      return {};
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Change password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByLabelText(/New password/i);
    const updateBtn = screen.getByRole('button', { name: 'Update password' });

    // Should be hidden initially
    expect(screen.queryByText(/Password must have:/)).not.toBeInTheDocument();

    // Type invalid password
    fireEvent.change(newPasswordInput, { target: { value: 'short' } });
    expect(screen.getByText(/Password must have:/)).toBeInTheDocument();
    expect(updateBtn).toBeDisabled();

    // Type valid password
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    expect(updateBtn).not.toBeDisabled();
    expect(screen.getByText('8-64 characters').previousSibling.textContent).toBe('✓');
  });
});
