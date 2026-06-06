import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../test/baseUrl';
import { renderWithProviders } from '../../test/renderWithProviders';
import { server } from '../../test/server';

import {
  ActivityFeedModal,
  __resetSeenThisSession,
} from './ActivityFeedModal';

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
    rank_value: 100,
    summary: 'You owe 100 on your weekly tax bill',
    created_at: '2026-06-01T10:00:00Z',
    refreshed_at: '2026-06-01T10:00:00Z',
    aggregate_count: 1,
    ...overrides,
  };
}

describe('ActivityFeedModal', () => {
  beforeEach(() => {
    __resetSeenThisSession();
  });

  it('renders the empty-state copy when the feed has no items', async () => {
    renderWithProviders(<ActivityFeedModal open={true} onClose={vi.fn()} />);
    expect(
      await screen.findByText(/All clear — nothing new\./i)
    ).toBeInTheDocument();
  });

  it('renders alerts and notifications in two labelled sections', async () => {
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({
          items: [
            makeItem({
              uid: 1,
              kind: 'bill_due',
              event_class: 'alert',
              summary: 'Alert row',
            }),
            makeItem({
              uid: 2,
              kind: 'bill_paid',
              event_class: 'notification',
              summary: 'Notif row',
            }),
          ],
          has_more: false,
        })
      )
    );

    renderWithProviders(<ActivityFeedModal open={true} onClose={vi.fn()} />);

    expect(await screen.findByText('Alert row')).toBeInTheDocument();
    expect(await screen.findByText('Notif row')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /alerts/i })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /notifications/i })
    ).toBeInTheDocument();
  });

  it('fires the soft-ack POST on open (hard:false)', async () => {
    const seen = vi.fn();
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({ items: [makeItem()], has_more: false })
      ),
      http.post(`${API_BASE}/activity/seen`, async ({ request }) => {
        seen(await request.json());
        return HttpResponse.json({ affected: 1 });
      })
    );

    renderWithProviders(<ActivityFeedModal open={true} onClose={vi.fn()} />);

    await screen.findByText(/You owe 100/i);
    await waitFor(() => expect(seen).toHaveBeenCalled());
    expect(seen).toHaveBeenCalledWith(
      expect.objectContaining({ hard: false })
    );
  });

  it('clicking a row opens the detail modal in-place (feed stays mounted)', async () => {
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({ items: [makeItem()], has_more: false })
      )
    );

    renderWithProviders(<ActivityFeedModal open={true} onClose={vi.fn()} />);

    const row = await screen.findByText(/You owe 100/i);
    fireEvent.click(row);

    // Detail modal mounts on top.
    expect(
      await screen.findByRole('dialog', { name: /Activity detail/i })
    ).toBeInTheDocument();
    // Feed modal is still in the DOM underneath (Radix marks it
    // aria-hidden when stacked, so query with `hidden: true` to look
    // inside the hidden subtree).
    expect(
      screen.getByRole('heading', { name: /Recent activity/i, hidden: true })
    ).toBeInTheDocument();
  });
});
