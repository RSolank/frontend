import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { DataExportPanel } from './DataExportPanel';

describe('DataExportPanel', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'test-token');
  });

  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it('renders the 8 BE-listed resources + the CSV/JSON format toggle', () => {
    renderWithProviders(<DataExportPanel />);
    expect(screen.getByTestId('export-transactions')).toBeInTheDocument();
    expect(screen.getByTestId('export-beneficiaries')).toBeInTheDocument();
    expect(screen.getByTestId('export-tax-bills')).toBeInTheDocument();
    expect(screen.getByTestId('export-tax-details')).toBeInTheDocument();
    expect(screen.getByTestId('export-spend-by-tag')).toBeInTheDocument();
    expect(screen.getByTestId('export-spend-by-merchant')).toBeInTheDocument();
    expect(screen.getByTestId('export-bank-accounts')).toBeInTheDocument();
    expect(screen.getByTestId('export-profile')).toBeInTheDocument();
    expect(screen.getByTestId('export-format-csv')).toBeInTheDocument();
    expect(screen.getByTestId('export-format-json')).toBeInTheDocument();
  });

  it('downloads with the currently-selected format', async () => {
    let exportedPath: string | null = null;
    server.use(
      http.get(`${API_BASE}/exports/transactions`, ({ request }) => {
        exportedPath = new URL(request.url).search;
        return new HttpResponse('a,b\n1,2', {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        });
      })
    );

    renderWithProviders(<DataExportPanel />);
    // Flip to JSON before clicking.
    fireEvent.click(screen.getByTestId('export-format-json'));
    // Stub createObjectURL — happy-dom's blob handling differs.
    const objectUrl = 'blob:test-url';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    fireEvent.click(screen.getByTestId('export-transactions'));

    await waitFor(() => {
      expect(exportedPath).toBe('?format=json');
    });
  });

  it('surfaces a non-OK response inline', async () => {
    server.use(
      http.get(`${API_BASE}/exports/transactions`, () =>
        HttpResponse.json({ detail: 'Forbidden' }, { status: 403 })
      )
    );

    renderWithProviders(<DataExportPanel />);
    fireEvent.click(screen.getByTestId('export-transactions'));
    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(/Failed to export transactions \(403\)/);
  });
});
