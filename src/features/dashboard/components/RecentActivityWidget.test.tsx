import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import {
  RecentActivityWidget,
  __resetActivitySoftAckForTests,
} from './RecentActivityWidget';

const SAMPLE_EVENTS = [
  {
    event_id: 'bill_generated:bill:42',
    kind: 'bill_generated',
    priority: 1,
    value: 87.4,
    at: new Date(Date.now() - 5 * 60_000).toISOString(),
    summary: 'Weekly tax bill of 250.00 generated for 2026-05-18 to 2026-05-24',
    subject_type: 'bill',
    subject_id: '42',
    state: 'live',
    source: 'worker',
    meta: { amount: 250.0 },
  },
  {
    event_id: 'budget_breached:budget:7',
    kind: 'budget_breached',
    priority: 1,
    value: 60.2,
    at: new Date(Date.now() - 30 * 60_000).toISOString(),
    summary: 'Groceries budget breached by 50.00 this month',
    subject_type: 'budget',
    subject_id: '7',
    state: 'live',
    source: 'engine',
    meta: {},
  },
];

describe('<RecentActivityWidget>', () => {
  beforeEach(() => {
    __resetActivitySoftAckForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the empty state when the feed is empty', async () => {
    renderWithProviders(<RecentActivityWidget />);
    await waitFor(() => {
      expect(
        screen.getByText(/nothing to see yet/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('dashboard-activity-list')
    ).not.toBeInTheDocument();
  });

  it('renders the returned events with summary + relative time', async () => {
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({
          events: SAMPLE_EVENTS,
          returned_count: SAMPLE_EVENTS.length,
          has_more: false,
        })
      )
    );

    renderWithProviders(<RecentActivityWidget />);
    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-activity-list')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/weekly tax bill of 250\.00 generated/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/groceries budget breached/i)
    ).toBeInTheDocument();
  });

  it('fires POST /seen with signal=soft on first render and hard on click', async () => {
    const seenSpy = vi.fn();
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({
          events: SAMPLE_EVENTS,
          returned_count: SAMPLE_EVENTS.length,
          has_more: false,
        })
      ),
      http.post(`${API_BASE}/activity/seen`, async ({ request }) => {
        const body = (await request.json()) as {
          events: string[];
          signal: 'soft' | 'hard';
        };
        seenSpy(body);
        return HttpResponse.json({ updated: body.events.length });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<RecentActivityWidget />);

    await waitFor(() => {
      expect(seenSpy).toHaveBeenCalledWith({
        events: expect.arrayContaining([
          'bill_generated:bill:42',
          'budget_breached:budget:7',
        ]),
        signal: 'soft',
      });
    });

    await user.click(
      screen.getByRole('button', {
        name: /weekly tax bill of 250\.00 generated/i,
      })
    );

    await waitFor(() => {
      expect(seenSpy).toHaveBeenCalledWith({
        events: ['bill_generated:bill:42'],
        signal: 'hard',
      });
    });
  });

  it('shows an error message when the feed fails to load', async () => {
    server.use(
      http.get(`${API_BASE}/activity`, () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 })
      )
    );

    renderWithProviders(<RecentActivityWidget />);
    await waitFor(() => {
      expect(screen.getByText(/couldn't load activity/i)).toBeInTheDocument();
    });
  });
});
