import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../test/baseUrl';
import { renderWithProviders } from '../../test/renderWithProviders';
import { server } from '../../test/server';

import { ActivityDetailModal } from './ActivityDetailModal';

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    uid: 1,
    kind: 'bill_due',
    event_class: 'alert',
    domain: 'taxation',
    subject_type: 'bill',
    subject_id: '42',
    priority: 1,
    state: 'active',
    summary: 'You owe 100 on your weekly tax bill',
    created_at: '2026-06-01T10:00:00Z',
    refreshed_at: '2026-06-01T10:00:00Z',
    aggregate_count: 1,
    ...overrides,
  };
}

describe('ActivityDetailModal', () => {
  it('fires the hard-ack POST when the modal opens', async () => {
    const seen = vi.fn();
    server.use(
      http.post(`${API_BASE}/activity/seen`, async ({ request }) => {
        seen(await request.json());
        return HttpResponse.json({ affected: 1 });
      })
    );

    renderWithProviders(
      <ActivityDetailModal
        item={makeItem({ subject_type: 'account', subject_id: '1' })}
        open={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(seen).toHaveBeenCalled());
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ hard: true }));
  });

  it('shows a CTA link for subjects with a known route', async () => {
    renderWithProviders(
      <ActivityDetailModal
        item={makeItem({ subject_type: 'bill', subject_id: '42' })}
        open={true}
        onClose={vi.fn()}
      />
    );

    // Wait for the modal to mount + the bill GET to settle.
    expect(
      await screen.findByRole('link', { name: /View bill/i })
    ).toHaveAttribute('href', '/consumption-tax?bill=42');
  });

  it('omits the CTA for subjects with no mapped route', async () => {
    renderWithProviders(
      <ActivityDetailModal
        item={makeItem({
          subject_type: 'something_unknown',
          subject_id: '99',
        })}
        open={true}
        onClose={vi.fn()}
      />
    );

    await screen.findByRole('dialog', { name: /Activity detail/i });
    expect(
      screen.queryByRole('link', { name: /View|Open|Manage/i })
    ).toBeNull();
  });

  it('renders the feed-row summary in the header regardless of subject', async () => {
    renderWithProviders(
      <ActivityDetailModal
        item={makeItem({
          subject_type: 'account_security',
          subject_id: '1',
          summary: 'Secure your account: set up backup codes.',
        })}
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByText(/Secure your account: set up backup codes\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Open security/i })
    ).toHaveAttribute('href', '/account/security');
  });
});
