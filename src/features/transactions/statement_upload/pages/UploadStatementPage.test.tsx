import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../test/server';
import { renderWithProviders } from '../../../../test/renderWithProviders';

import { UploadStatementPage } from './UploadStatementPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  mockNavigate.mockReset();
  server.use(
    http.get('http://localhost:4000/api/tags', () =>
      HttpResponse.json({ tags: [] })
    )
  );
});

describe('UploadStatementPage', () => {
  it('renders title and file picker', () => {
    renderWithProviders(<UploadStatementPage />);
    expect(screen.getByText(/Upload statement/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose file/i)).toBeInTheDocument();
  });

  it('runs the upload → map → categorize pipeline', async () => {
    const hits: string[] = [];
    server.use(
      http.post(
        'http://localhost:4000/api/transactions/upload-statement',
        () => {
          hits.push('upload');
          return HttpResponse.json({
            upload_id: 7,
            inserted_count: 1,
            categorized_count: 0,
            problematic_count: 0,
          });
        }
      ),
      http.post(
        'http://localhost:4000/api/transactions/upload-statement/7/map-beneficiaries',
        () => {
          hits.push('map');
          return HttpResponse.json({ ok: true });
        }
      ),
      http.post(
        'http://localhost:4000/api/transactions/upload-statement/7/categorize',
        () => {
          hits.push('categorize');
          return HttpResponse.json({
            upload_id: 7,
            inserted_count: 1,
            categorized_count: 1,
            problematic_count: 0,
            requires_confirmation: false,
          });
        }
      )
    );

    renderWithProviders(<UploadStatementPage />);

    const file = new File(['date,beneficiary,amount\n2023-01-01,Test,100'], 'statement.csv', {
      type: 'text/csv',
    });
    fireEvent.change(screen.getByLabelText(/Choose file/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(hits).toEqual(['upload', 'map', 'categorize']);
      expect(
        screen.getByText(/Upload completed and categorized/i)
      ).toBeInTheDocument();
    });
  });

  it('shows error if upload fails', async () => {
    server.use(
      http.post('http://localhost:4000/api/transactions/upload-statement', () =>
        HttpResponse.json({ error: 'Invalid file format' }, { status: 400 })
      )
    );

    renderWithProviders(<UploadStatementPage />);

    const file = new File(['x'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/Choose file/i), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(screen.getByText(/Invalid file format/i)).toBeInTheDocument();
    });
  });
});
