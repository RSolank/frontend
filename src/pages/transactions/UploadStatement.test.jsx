import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { apiFetch } from '../../shared/api/apiClient';

import { UploadStatementPage } from './UploadStatement';

vi.mock('../../shared/api/apiClient', () => ({
  apiFetch: vi.fn(),
}));

// Remove manual mock of react-router-dom to avoid 'undefined component' errors.
// We can use MemoryRouter and check navigation if needed via window.location or similar.

describe('UploadStatementPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders and handles file selection and upload', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return { tags: [] };
      return { summary: { total: 1, imported: 1, skipped: 0 }, upload_id: 123 };
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <UploadStatementPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Upload statement/i)).toBeInTheDocument();

    const file = new File(
      ['date,beneficiary,amount\n2023-01-01,Test,100'],
      'statement.csv',
      { type: 'text/csv' }
    );
    const input = screen.getByLabelText(/Choose file/i);

    fireEvent.change(input, { target: { files: [file] } });

    // In the real component, it doesn't show the filename until upload or something?
    // Let's check the UI. Line 256 has <input type="file">.

    apiFetch.mockResolvedValueOnce({
      upload_id: 1,
      requires_confirmation: false,
    }); // POST upload
    apiFetch.mockResolvedValueOnce({
      inserted_count: 1,
      categorized_count: 1,
      problematic_count: 0,
    }); // POST categorize

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/transactions/upload-statement',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('shows error message on failure', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return { tags: [] };
      throw { error: 'Invalid file format' };
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <UploadStatementPage />
      </MemoryRouter>
    );

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/Choose file/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(screen.getByText(/Invalid file format/i)).toBeInTheDocument();
    });
  });
});
