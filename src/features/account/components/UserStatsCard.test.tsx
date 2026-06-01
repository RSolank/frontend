import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { server } from '../../../test/server';

import { UserStatsCard } from './UserStatsCard';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderCard() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <UserStatsCard />
    </QueryClientProvider>
  );
}

describe('UserStatsCard', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  it('renders counts + joined date when the endpoint returns data', async () => {
    server.use(
      http.get(`${API_BASE}/users/me/stats`, () =>
        HttpResponse.json({
          joined_at: '2025-12-04T10:23:00Z',
          last_active_at: '2026-05-28T19:01:00Z',
          total_transactions: 1247,
          total_budgets: 12,
          total_beneficiaries: 67,
          active_recurring: 4,
        })
      )
    );

    renderCard();

    await waitFor(() =>
      expect(screen.getByText('1,247')).toBeInTheDocument()
    );
    expect(screen.getByText('67')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // active_recurring
    expect(screen.getByText(/Joined/)).toBeInTheDocument();
  });

  it('renders active_recurring = 0 for a brand-new account', async () => {
    server.use(
      http.get(`${API_BASE}/users/me/stats`, () =>
        HttpResponse.json({
          joined_at: '2025-12-04T10:23:00Z',
          last_active_at: null,
          total_transactions: 10,
          total_budgets: 2,
          total_beneficiaries: 3,
          active_recurring: 0,
        })
      )
    );

    renderCard();
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    expect(screen.getByText('Recurring')).toBeInTheDocument();
  });
});
