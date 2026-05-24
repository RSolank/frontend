import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { apiFetch } from '../../utils/apiClient.js';

import { BeneficiaryDetailPage } from './BeneficiaryDetailPage.jsx';

vi.mock('../../utils/apiClient.js', () => ({
  apiFetch: vi.fn(),
}));

const mockBeneficiary = {
  uid: 5,
  name: 'Mobile Recharged',
  aliases: ['Jio', 'Airtel'],
  beneficiary_type: 'merchant',
  merchant: { category: 'utility', contact: null, upi_id: null },
  person: null,
};

const mockList = [
  mockBeneficiary,
  { uid: 6, name: 'Other', aliases: [], beneficiary_type: 'merchant' },
];

const renderDetail = () =>
  render(
    <MemoryRouter
      initialEntries={['/beneficiaries/5']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/beneficiaries/:id" element={<BeneficiaryDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('BeneficiaryDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.confirm = vi.fn(() => true);
  });

  it('renders read-only beneficiary with alias chips', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/beneficiaries/5') return mockBeneficiary;
      if (url === '/api/beneficiaries') return mockList;
      return {};
    });

    renderDetail();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Mobile Recharged' })
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Jio')).toBeInTheDocument();
    expect(screen.getByText('Airtel')).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/Enter alias/i)
    ).not.toBeInTheDocument();
  });

  it('shows merge form in edit mode and checks alias uniqueness', async () => {
    apiFetch.mockImplementation(async (url, options) => {
      if (url === '/api/beneficiaries/5') return mockBeneficiary;
      if (url === '/api/beneficiaries') return mockList;
      if (url.includes('/check-alias'))
        return { alias: 'NewAlias', unique: true };
      if (url === '/api/beneficiaries/5' && options?.method === 'PATCH') {
        return { ...mockBeneficiary, aliases: ['Jio', 'Airtel', 'NewAlias'] };
      }
      return {};
    });

    renderDetail();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(screen.getByText('Consolidate Beneficiaries')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter alias/i)).toBeInTheDocument();
    });

    const aliasInput = screen.getByPlaceholderText(/Enter alias/i);
    fireEvent.change(aliasInput, { target: { value: 'NewAlias' } });

    await waitFor(() => {
      expect(screen.getByText('Alias is available')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add alias' })
      ).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add alias' }));

    await waitFor(() => {
      expect(screen.getByText('NewAlias')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/beneficiaries/5',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('NewAlias'),
        })
      );
    });
  });

  it('switches form fields when the beneficiary type changes', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/beneficiaries/5') {
        return {
          ...mockBeneficiary,
          merchant: {
            category: 'utility',
            contact: '9999999999',
            upi_id: 'store@upi',
          },
        };
      }
      if (url === '/api/beneficiaries') return mockList;
      return {};
    });

    renderDetail();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const typeSelect = screen.getByLabelText('Type');
    fireEvent.change(typeSelect, { target: { value: 'person' } });

    expect(screen.getByLabelText('Relationship')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toHaveValue('9999999999');
    expect(screen.getByLabelText('UPI ID')).toHaveValue('store@upi');

    fireEvent.change(screen.getByLabelText('Relationship'), {
      target: { value: 'friend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/beneficiaries/5',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"beneficiary_type":"person"'),
        })
      );
    });
  });

  it('warns when merge source and target types differ', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/beneficiaries/5') {
        return mockBeneficiary;
      }
      if (url === '/api/beneficiaries') {
        return [
          mockBeneficiary,
          {
            uid: 6,
            name: 'Jane',
            aliases: [],
            beneficiary_type: 'person',
            person: { relationship_type: 'friend' },
          },
        ];
      }
      return {};
    });

    renderDetail();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByLabelText('Into Target (will keep)'), {
      target: { value: '6' },
    });

    await waitFor(() => {
      expect(screen.getByText(/Type mismatch detected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/merchant fields map to merchant fields/i)
      ).toBeInTheDocument();
    });
  });
});
