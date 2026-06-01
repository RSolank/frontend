import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { useStatementUploadJobStore } from '../../../../shared/state/statementUploadJob.store';
import { API_BASE } from '../../../../test/baseUrl';
import { renderWithProviders } from '../../../../test/renderWithProviders';
import { server } from '../../../../test/server';

import { UploadStatementPage } from './UploadStatementPage';

beforeEach(() => {
  useStatementUploadJobStore.getState().reset();
});

afterEach(() => {
  useStatementUploadJobStore.getState().reset();
});

function fileWithName(name: string, type = 'text/csv') {
  return new File(['date,amount\n2026-06-01,10.00'], name, { type });
}

describe('UploadStatementPage', () => {
  test('renders the upload card initially', () => {
    renderWithProviders(<UploadStatementPage />);
    expect(screen.getByTestId('statement-file-input')).toBeInTheDocument();
    expect(screen.getByTestId('statement-upload-submit')).toBeDisabled();
  });

  test('filename match → renders match card + enables Upload', async () => {
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('phonepe-may-2026.pdf', 'application/pdf')
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('statement-parser-match-card')
      ).toHaveTextContent(/PhonePe statement \(PDF\)/)
    );
    expect(screen.getByTestId('statement-upload-submit')).toBeEnabled();
  });

  test('no filename match → inline dropdown forces an explicit pick', async () => {
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('budget.csv', 'text/csv')
    );
    // No match — match card hidden, dropdown visible, Upload disabled.
    await waitFor(() =>
      expect(screen.getByTestId('parser-inline-picker')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('statement-parser-match-card')).toBeNull();
    expect(screen.getByTestId('statement-upload-submit')).toBeDisabled();

    // Pick from the dropdown — match card now renders + Upload enabled.
    await userEvent.selectOptions(
      screen.getByTestId('parser-inline-select'),
      'csv'
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('statement-parser-match-card')
      ).toBeInTheDocument()
    );
    expect(screen.getByTestId('statement-upload-submit')).toBeEnabled();
  });

  test('Change parser link opens picker; pick overrides match', async () => {
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('phonepe.pdf', 'application/pdf')
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('statement-parser-match-card')
      ).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('statement-parser-change'));
    expect(screen.getByTestId('parser-picker-list')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('parser-picker-option-csv'));
    await userEvent.click(screen.getByTestId('parser-picker-confirm'));
    await waitFor(() =>
      expect(
        screen.getByTestId('statement-parser-match-card')
      ).toHaveTextContent(/Generic CSV statement/)
    );
  });

  test('upload sends parser_override in the FormData', async () => {
    let receivedOverride: string | null = null;
    server.use(
      http.post(
        `${API_BASE}/statement-uploads`,
        async ({ request }) => {
          const fd = await request.formData();
          const val = fd.get('parser_override');
          receivedOverride = typeof val === 'string' ? val : null;
          return HttpResponse.json(
            { job_id: 99, status: 'PENDING' },
            { status: 202 }
          );
        }
      ),
      http.get(`${API_BASE}/statement-uploads/99`, () =>
        HttpResponse.json({
          job_id: 99,
          status: 'COMPLETE',
          file_name: 'phonepe.pdf',
          parser_used: 'phonepe',
          source_type: 'phonepe',
          txns_parsed: 1,
          txns_inserted: 1,
          error_detail: null,
          detected_identifier: null,
          bank_account_id: null,
          suggest_register_account: false,
          created_at: '2026-06-01T00:00:00Z',
          completed_at: '2026-06-01T00:00:01Z',
        })
      )
    );
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('phonepe.pdf', 'application/pdf')
    );
    await userEvent.click(screen.getByTestId('statement-upload-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('statement-job-complete')).toBeInTheDocument()
    );
    expect(receivedOverride).toBe('phonepe');
  });

  test('409 duplicate surfaces inline error (no Pick parser button)', async () => {
    server.use(
      http.post(`${API_BASE}/statement-uploads`, () =>
        HttpResponse.json({ detail: 'duplicate' }, { status: 409 })
      )
    );
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('phonepe.pdf', 'application/pdf')
    );
    await userEvent.click(screen.getByTestId('statement-upload-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('statement-upload-error')).toHaveTextContent(
        /already uploaded this exact file/i
      )
    );
    expect(screen.queryByTestId('statement-upload-pick-parser')).toBeNull();
  });

  test('422 surfaces "Pick parser" button that opens the modal', async () => {
    server.use(
      http.post(`${API_BASE}/statement-uploads`, () =>
        HttpResponse.json(
          {
            detail: {
              message: 'No parser detected',
              available_parsers: [
                { key: 'phonepe', label: 'PhonePe statement (PDF)', source_type: 'phonepe' },
                { key: 'csv', label: 'Generic CSV statement', source_type: 'csv' },
              ],
            },
          },
          { status: 422 }
        )
      )
    );
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('phonepe.pdf', 'application/pdf')
    );
    await userEvent.click(screen.getByTestId('statement-upload-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('statement-upload-pick-parser')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('statement-upload-pick-parser'));
    expect(screen.getByTestId('parser-picker-list')).toBeInTheDocument();
  });

  test('COMPLETE + suggest_register_account renders informational notice', async () => {
    server.use(
      http.post(`${API_BASE}/statement-uploads`, () =>
        HttpResponse.json({ job_id: 5, status: 'PENDING' }, { status: 202 })
      ),
      http.get(`${API_BASE}/statement-uploads/5`, () =>
        HttpResponse.json({
          job_id: 5,
          status: 'COMPLETE',
          file_name: 'phonepe.pdf',
          parser_used: 'phonepe',
          source_type: 'upi',
          txns_parsed: 12,
          txns_inserted: 12,
          error_detail: null,
          detected_identifier: 'user@upi',
          bank_account_id: null,
          suggest_register_account: true,
          created_at: '2026-06-01T00:00:00Z',
          completed_at: '2026-06-01T00:00:01Z',
        })
      )
    );
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('phonepe.pdf', 'application/pdf')
    );
    await userEvent.click(screen.getByTestId('statement-upload-submit'));
    await waitFor(() =>
      expect(
        screen.getByTestId('statement-job-suggest-register-account')
      ).toHaveTextContent(/user@upi/)
    );
    // Batch 13 upgrade: CTA links to /settings/bank-accounts with
    // the detected identifier as the ?register= deep-link param.
    expect(
      screen.getByTestId('statement-job-register-account-cta')
    ).toHaveAttribute(
      'href',
      '/settings/bank-accounts?register=user%40upi'
    );
  });

  test('FAILED status renders error_detail + Try again', async () => {
    server.use(
      http.post(`${API_BASE}/statement-uploads`, () =>
        HttpResponse.json({ job_id: 7, status: 'PENDING' }, { status: 202 })
      ),
      http.get(`${API_BASE}/statement-uploads/7`, () =>
        HttpResponse.json({
          job_id: 7,
          status: 'FAILED',
          file_name: 'broken.pdf',
          parser_used: null,
          source_type: null,
          txns_parsed: 0,
          txns_inserted: 0,
          error_detail: 'PDF was password-protected.',
          detected_identifier: null,
          bank_account_id: null,
          suggest_register_account: false,
          created_at: '2026-06-01T00:00:00Z',
          completed_at: '2026-06-01T00:00:01Z',
        })
      )
    );
    renderWithProviders(<UploadStatementPage />);
    await userEvent.upload(
      screen.getByTestId('statement-file-input'),
      fileWithName('phonepe.pdf', 'application/pdf')
    );
    await userEvent.click(screen.getByTestId('statement-upload-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('statement-job-failed')).toBeInTheDocument()
    );
    expect(
      screen.getByText(/PDF was password-protected/i)
    ).toBeInTheDocument();
  });
});
