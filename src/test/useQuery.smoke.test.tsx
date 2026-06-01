import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { API_BASE } from './baseUrl';

// End-to-end Batch 0 smoke: real useQuery -> real fetch -> MSW handler
// in src/test/handlers/health.ts -> back through React Query into the
// component. Proves the four pieces wired across steps 4 and 8 actually
// compose. Per-feature query hooks land in api/queries.ts from Batch 2.

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function HealthCard() {
  const { data, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/health`);
      return (await res.json()) as { status: string };
    },
  });
  if (isPending) return <span>loading…</span>;
  return <span data-testid="health-status">{data?.status ?? 'unknown'}</span>;
}

describe('TanStack Query + MSW (Batch 0 smoke)', () => {
  it('useQuery resolves data served by an MSW handler', async () => {
    render(
      <QueryClientProvider client={makeClient()}>
        <HealthCard />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('health-status')).toHaveTextContent('ok')
    );
  });
});
