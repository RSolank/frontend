import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/server';

import { BeneficiaryDetailPage } from './BeneficiaryDetailPage';

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

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/beneficiaries/5']}>
        <Routes>
          <Route
            path="/beneficiaries/:id"
            element={<BeneficiaryDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.confirm = vi.fn(() => true);
  server.use(
    http.get('http://localhost:4000/api/beneficiaries/5', () =>
      HttpResponse.json(mockBeneficiary)
    ),
    http.get('http://localhost:4000/api/beneficiaries', () =>
      HttpResponse.json(mockList)
    ),
    http.get('http://localhost:4000/api/beneficiaries/relationships', () =>
      HttpResponse.json(['friend', 'family'])
    ),
    http.get('http://localhost:4000/api/categorization-rules', () =>
      HttpResponse.json({ rules: [] })
    ),
    http.get('http://localhost:4000/api/tags', () =>
      HttpResponse.json({ tags: [] })
    )
  );
});

describe('BeneficiaryDetailPage', () => {
  it('renders read-only beneficiary with alias chips', async () => {
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
    const patchSpy = vi.fn();
    server.use(
      http.get(
        'http://localhost:4000/api/beneficiaries/check-alias',
        ({ request }) => {
          const url = new URL(request.url);
          const alias = url.searchParams.get('alias') ?? '';
          return HttpResponse.json({ alias, unique: alias === 'NewAlias' });
        }
      ),
      http.patch(
        'http://localhost:4000/api/beneficiaries/5',
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patchSpy(body);
          return HttpResponse.json({
            ...mockBeneficiary,
            aliases: ['Jio', 'Airtel', 'NewAlias'],
          });
        }
      )
    );

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
      expect(patchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          aliases: expect.arrayContaining(['NewAlias']),
        })
      );
    });
  });

  it('switches form fields when the beneficiary type changes', async () => {
    const patchSpy = vi.fn();
    server.use(
      http.get('http://localhost:4000/api/beneficiaries/5', () =>
        HttpResponse.json({
          ...mockBeneficiary,
          merchant: {
            category: 'utility',
            contact: '9999999999',
            upi_id: 'store@upi',
          },
        })
      ),
      http.patch(
        'http://localhost:4000/api/beneficiaries/5',
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patchSpy(body);
          return HttpResponse.json({
            ...mockBeneficiary,
            beneficiary_type: 'person',
          });
        }
      )
    );

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
      expect(patchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ beneficiary_type: 'person' })
      );
    });
  });

  it('warns when merge source and target types differ', async () => {
    server.use(
      http.get('http://localhost:4000/api/beneficiaries', () =>
        HttpResponse.json([
          mockBeneficiary,
          {
            uid: 6,
            name: 'Jane',
            aliases: [],
            beneficiary_type: 'person',
            person: { relationship_type: 'friend' },
          },
        ])
      )
    );

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
