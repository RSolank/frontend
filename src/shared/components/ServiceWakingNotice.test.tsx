import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceWakingNotice } from './ServiceWakingNotice';

// The notice gates on `useIsFetching() + useIsMutating() > 0` for
// >5 s. We exercise the timer behavior — no real network calls
// needed; flipping a query's state via the QueryClient is enough.

describe('ServiceWakingNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderWithClient(client: QueryClient) {
    return render(
      <QueryClientProvider client={client}>
        <ServiceWakingNotice />
      </QueryClientProvider>
    );
  }

  it('stays hidden when nothing is pending', () => {
    const client = new QueryClient();
    renderWithClient(client);
    expect(screen.queryByTestId('service-waking-notice')).toBeNull();
  });

  it('appears after 5 s when a query is in flight', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Kick off a never-resolving query so isFetching stays > 0.
    void client.fetchQuery({
      queryKey: ['pending'],
      queryFn: () => new Promise(() => {}),
    });

    renderWithClient(client);

    // Not yet — under the 5 s threshold.
    expect(screen.queryByTestId('service-waking-notice')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5_001);
    });
    expect(screen.getByTestId('service-waking-notice')).toHaveTextContent(
      /Waking up the service/i
    );
  });

  it('hides again when the pending count drops to zero', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let resolveFn: ((value: unknown) => void) | null = null;
    void client.fetchQuery({
      queryKey: ['pending-then-done'],
      queryFn: () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    });

    renderWithClient(client);
    act(() => {
      vi.advanceTimersByTime(5_001);
    });
    expect(screen.getByTestId('service-waking-notice')).toBeInTheDocument();

    // Resolve the query — isFetching drops to 0 and the effect
    // re-fires; the notice unmounts on the next tick. Switch off
    // fake timers so waitFor's own setInterval polling works.
    vi.useRealTimers();
    await act(async () => {
      resolveFn?.({ ok: true });
    });
    await waitFor(() =>
      expect(screen.queryByTestId('service-waking-notice')).toBeNull()
    );
  });
});
