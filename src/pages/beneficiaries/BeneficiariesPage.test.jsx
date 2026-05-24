import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { apiFetch } from '../../utils/apiClient.js';

import { BeneficiariesPage } from './BeneficiariesPage.jsx';

vi.mock('../../utils/apiClient.js', () => ({
  apiFetch: vi.fn(),
}));

const mockBeneficiaries = [
  {
    uid: 1,
    name: 'Mobile Recharged',
    aliases: ['Jio', 'Airtel'],
    beneficiary_type: 'merchant',
    merchant: { category: 'utility' },
    person: null,
  },
  {
    uid: 2,
    name: 'Jane',
    aliases: [],
    beneficiary_type: 'person',
    merchant: null,
    person: { relationship_type: 'friend' },
  },
];

describe('BeneficiariesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders beneficiaries with aliases in bracket format', async () => {
    apiFetch.mockResolvedValue(mockBeneficiaries);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <BeneficiariesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mobile Recharged')).toBeInTheDocument();
    });

    expect(screen.getByText('(Jio, Airtel)')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '← Back to Dashboard' })
    ).toHaveAttribute('href', '/dashboard');
  });

  it('filters by search and type', async () => {
    apiFetch.mockResolvedValue(mockBeneficiaries);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <BeneficiariesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Jane')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Search by name or alias/i), {
      target: { value: 'Jio' },
    });
    expect(screen.getByText('Mobile Recharged')).toBeInTheDocument();
    expect(screen.queryByText('Jane')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search by name or alias/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByDisplayValue('All types'), {
      target: { value: 'person' },
    });
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.queryByText('Mobile Recharged')).not.toBeInTheDocument();
  });

  it('creates merchant with alias chips after uniqueness check', async () => {
    apiFetch.mockImplementation(async (url, options) => {
      if (url === '/api/beneficiaries' && !options) return mockBeneficiaries;
      if (url.includes('/check-alias')) return { alias: 'EKART', unique: true };
      if (url === '/api/beneficiaries' && options?.method === 'POST') {
        return {
          uid: 99,
          name: 'New Store',
          aliases: ['EKART'],
          beneficiary_type: 'merchant',
        };
      }
      return {};
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <BeneficiariesPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '+ Add New' })
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Add New' }));

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Store' },
    });

    const aliasInput = screen.getByPlaceholderText(/Enter alias/i);
    fireEvent.change(aliasInput, { target: { value: 'EKART' } });

    await waitFor(() => {
      expect(screen.getByText('Alias is available')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add alias' })
      ).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add alias' }));

    await waitFor(() => {
      expect(screen.getByText('EKART')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/beneficiaries',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"aliases":["EKART"]'),
        })
      );
    });
  });
});
