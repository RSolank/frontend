import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_BASE } from '../../test/baseUrl';
import { renderWithProviders } from '../../test/renderWithProviders';
import { server } from '../../test/server';
import { useActivityLastSeenStore } from '../state/activityLastSeen.store';

import { ActivityBell } from './ActivityBell';

// `refreshed_at` ISO helper relative to a known origin so the badge
// math (refreshed_at > lastSeenAt) is deterministic.
const NOW = 1_750_000_000_000;
function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

function makeItem(uid: number, refreshedAt: string) {
  return {
    uid,
    kind: 'bill_due',
    event_class: 'alert',
    domain: 'taxation',
    subject_type: 'bill',
    subject_id: String(uid),
    priority: 2,
    state: 'active',
    summary: `Item ${uid}`,
    created_at: refreshedAt,
    refreshed_at: refreshedAt,
    aggregate_count: 1,
  };
}

describe('ActivityBell', () => {
  beforeEach(() => {
    // Reset the persisted timestamp before every case so tests are
    // independent — localStorage carries between describe blocks
    // under happy-dom otherwise.
    useActivityLastSeenStore.setState({ lastSeenAt: 0 });
    window.localStorage.removeItem('activity-last-seen');
  });
  afterEach(() => {
    useActivityLastSeenStore.setState({ lastSeenAt: 0 });
  });

  it('shows a badge when items are newer than the last bell-open timestamp', async () => {
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({
          items: [makeItem(1, iso(0)), makeItem(2, iso(1_000))],
          has_more: false,
        })
      )
    );
    useActivityLastSeenStore.setState({ lastSeenAt: NOW - 10_000 });

    renderWithProviders(<ActivityBell enabled={true} />);

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Recent activity \(2 unread\)/i)
    ).toBeInTheDocument();
  });

  it('caps the badge at 5+', async () => {
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({
          items: Array.from({ length: 8 }, (_, i) =>
            makeItem(i + 1, iso(i * 100))
          ),
          has_more: false,
        })
      )
    );
    useActivityLastSeenStore.setState({ lastSeenAt: NOW - 10_000 });

    renderWithProviders(<ActivityBell enabled={true} />);

    expect(await screen.findByText('5+')).toBeInTheDocument();
  });

  it('does not render a badge when the feed is empty', async () => {
    renderWithProviders(<ActivityBell enabled={true} />);

    // Wait for the query settle so the absence is meaningful.
    await screen.findByLabelText(/Recent activity/i);
    expect(screen.queryByText(/^\d+$/)).toBeNull();
    expect(screen.queryByText('5+')).toBeNull();
  });

  it('clears the badge on bell open by stamping lastSeenAt', async () => {
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({
          items: [makeItem(1, iso(0))],
          has_more: false,
        })
      )
    );
    useActivityLastSeenStore.setState({ lastSeenAt: NOW - 10_000 });

    renderWithProviders(<ActivityBell enabled={true} />);

    const btn = await screen.findByLabelText(/Recent activity \(1 unread\)/i);
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(btn);

    // The store should now hold a fresh timestamp greater than the
    // item's refreshed_at, so the badge recomputes to 0.
    await waitFor(() => {
      expect(screen.queryByText('1')).toBeNull();
    });
    expect(useActivityLastSeenStore.getState().lastSeenAt).toBeGreaterThan(NOW);
  });

  it('does not fetch the feed when disabled (no badge ever)', () => {
    renderWithProviders(<ActivityBell enabled={false} />);
    // No badge regardless of the default empty MSW handler.
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });
});
