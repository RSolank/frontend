import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { BeneficiariesPage } from './BeneficiariesPage';

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

beforeEach(() => {
  server.use(
    http.get('http://localhost:4000/api/beneficiaries', () =>
      HttpResponse.json(mockBeneficiaries)
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

describe('BeneficiariesPage', () => {
  it('renders beneficiaries with aliases in bracket format', async () => {
    renderWithProviders(<BeneficiariesPage />);

    await waitFor(() => {
      expect(screen.getByText('Mobile Recharged')).toBeInTheDocument();
    });

    expect(screen.getByText('(Jio, Airtel)')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '← Back to Dashboard' })
    ).toHaveAttribute('href', '/dashboard');
  });

  it('filters by search and type', async () => {
    renderWithProviders(<BeneficiariesPage />);

    await waitFor(() => expect(screen.getByText('Jane')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Search by name or alias/i), {
      target: { value: 'Jio' },
    });
    expect(screen.getByText('Mobile Recharged')).toBeInTheDocument();
    expect(screen.queryByText('Jane')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search by name or alias/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Filter by type'), {
      target: { value: 'person' },
    });
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.queryByText('Mobile Recharged')).not.toBeInTheDocument();
  });

  it('creates merchant with alias chips after uniqueness check', async () => {
    const postSpy = vi.fn();
    server.use(
      http.get(
        'http://localhost:4000/api/beneficiaries/check-alias',
        ({ request }) => {
          const url = new URL(request.url);
          const alias = url.searchParams.get('alias') ?? '';
          return HttpResponse.json({ alias, unique: alias === 'EKART' });
        }
      ),
      http.post(
        'http://localhost:4000/api/beneficiaries',
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          postSpy(body);
          return HttpResponse.json({
            uid: 99,
            name: 'New Store',
            aliases: ['EKART'],
            beneficiary_type: 'merchant',
          });
        }
      )
    );

    renderWithProviders(<BeneficiariesPage />);

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
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Store',
          aliases: ['EKART'],
          beneficiary_type: 'merchant',
        })
      );
    });
  });
});
