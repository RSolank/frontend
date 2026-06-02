import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { routes } from './routes';

// AuthInit's mount-time refresh now goes through MSW handlers (see
// src/test/handlers/users.ts + metadata.ts). No apiFetch mock needed.

describe('App shell', () => {
  it('mounts the root layout (TopNav brand) at /', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });
    // Branding-aware TopNav uses TanStack Query — the real app wraps
    // a QueryClientProvider in providers.tsx; mirror it here.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    // The Batch 6.5 TopNav brand link surfaces with the brand
    // aria-label ("Aevum" post-Batch-16 rebrand) on every route —
    // confirms the shell mounted.
    const brands = await screen.findAllByLabelText(/aevum/i);
    expect(brands.length).toBeGreaterThan(0);
  });
});
