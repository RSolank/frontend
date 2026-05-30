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

    render(<RouterProvider router={router} />);

    // The Batch 6.5 TopNav brand link surfaces with the "Personal Budget"
    // aria-label on every route — confirms the shell mounted.
    const brands = await screen.findAllByLabelText(/personal budget/i);
    expect(brands.length).toBeGreaterThan(0);
  });
});
