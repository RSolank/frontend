import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { useStatementUploadJobStore } from '../../../../shared/state/statementUploadJob.store';
import { API_BASE } from '../../../../test/baseUrl';
import { renderWithProviders } from '../../../../test/renderWithProviders';
import { server } from '../../../../test/server';

import { StatementUploadDock } from './StatementUploadDock';

beforeEach(() => {
  useStatementUploadJobStore.getState().reset();
});

afterEach(() => {
  useStatementUploadJobStore.getState().reset();
});

describe('StatementUploadDock', () => {
  test('renders nothing without an active job', () => {
    renderWithProviders(<StatementUploadDock />, {
      initialEntries: ['/dashboard'],
    });
    expect(screen.queryByTestId('statement-upload-dock')).toBeNull();
  });

  test('renders nothing on /upload-statement (page already shows panel)', () => {
    useStatementUploadJobStore.getState().setActiveJobId(11);
    renderWithProviders(<StatementUploadDock />, {
      initialEntries: ['/upload-statement'],
    });
    expect(screen.queryByTestId('statement-upload-dock')).toBeNull();
  });

  test('shows in-progress dock while job is non-terminal', async () => {
    server.use(
      http.get(`${API_BASE}/statement-uploads/22`, () =>
        HttpResponse.json({
          job_id: 22,
          status: 'PROCESSING',
          stage: 'parsing',
          file_name: 'bank.csv',
          parser_used: null,
          source_type: null,
          txns_parsed: 0,
          txns_inserted: 0,
          error_detail: null,
          detected_identifier: null,
          bank_account_id: null,
          suggest_register_account: false,
          created_at: '2026-06-01T00:00:00Z',
          completed_at: null,
        })
      )
    );
    useStatementUploadJobStore.getState().setActiveJobId(22);
    renderWithProviders(<StatementUploadDock />, {
      initialEntries: ['/dashboard'],
    });
    // Wait for the file name to appear — that only happens once the
    // poll resolves with real data, past the initial isLoading branch.
    await waitFor(() =>
      expect(screen.getByText('bank.csv')).toBeInTheDocument()
    );
    expect(screen.getByText('Parsing…')).toBeInTheDocument();
  });

  test('FAILED state surfaces error_detail + persists until dismissed', async () => {
    server.use(
      http.get(`${API_BASE}/statement-uploads/33`, () =>
        HttpResponse.json({
          job_id: 33,
          status: 'FAILED',
          stage: 'parsing',
          file_name: 'broken.pdf',
          parser_used: null,
          source_type: null,
          txns_parsed: 0,
          txns_inserted: 0,
          error_detail: 'Password-protected PDF',
          detected_identifier: null,
          bank_account_id: null,
          suggest_register_account: false,
          created_at: '2026-06-01T00:00:00Z',
          completed_at: '2026-06-01T00:00:01Z',
        })
      )
    );
    useStatementUploadJobStore.getState().setActiveJobId(33);
    renderWithProviders(<StatementUploadDock />, {
      initialEntries: ['/dashboard'],
    });
    await waitFor(() =>
      expect(
        screen.getByTestId('statement-upload-dock-failed')
      ).toHaveTextContent(/Password-protected PDF/)
    );
    // Dismiss button clears the store + unmounts the dock content.
    await userEvent.click(screen.getByTestId('statement-upload-dock-dismiss'));
    expect(useStatementUploadJobStore.getState().activeJobId).toBeNull();
  });
});
