import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { routes } from './routes';

// AuthInit's mount-time refresh now goes through MSW handlers (see
// src/test/handlers/users.ts + metadata.ts). No apiFetch mock needed.

describe('App shell', () => {
  it('mounts the root layout (header + home link) at /', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('link', { name: /home/i })
    ).toBeInTheDocument();
  });
});
