import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { routes } from './routes';

// Mock apiFetch so AuthProvider's mount-time refresh doesn't hit the
// network. Replaced with MSW handlers when auth migrates in Batch 2.
vi.mock('../shared/api/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue({ user: null }),
}));

describe('App shell', () => {
  it('mounts the root layout (header + brand link) at /', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('link', { name: /personal budget/i })
    ).toBeInTheDocument();
  });
});
