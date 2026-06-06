import { screen } from '@testing-library/react';
import { vi } from 'vitest';

import { useAuth } from '../../features/auth/state/useAuth';
import { renderWithProviders } from '../../test/renderWithProviders';

import { HomePage } from './Home';

vi.mock('../../features/auth/state/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

describe('HomePage', () => {
  it('renders the unauthenticated CTAs when no user', async () => {
    // HomePage only reads `user`; cast the partial to the full hook shape.
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);

    renderWithProviders(<HomePage />);

    // Eyebrow text is the BE-supplied brand tagline (MSW default
    // returns "Future begins today" per src/test/handlers/metadata.ts).
    // `findBy` waits for the branding query to resolve since there's
    // no hardcoded synchronous fallback.
    expect(await screen.findByText(/Future begins today/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign in/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Register/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Go to dashboard/i })
    ).not.toBeInTheDocument();
  });

  it('shows a single Go-to-dashboard CTA when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { first_name: 'John' },
    } as ReturnType<typeof useAuth>);

    renderWithProviders(<HomePage />);

    // Authed visitors no longer auto-redirect; the landing page stays
    // accessible and the CTAs collapse into one "Go to dashboard"
    // link.
    const cta = screen.getByRole('link', { name: /Go to dashboard/i });
    expect(cta).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('button', { name: /Sign in/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Register/i })).toBeNull();
  });
});
