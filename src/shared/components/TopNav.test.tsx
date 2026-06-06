import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../state/auth.store';

import { TopNav } from './TopNav';

function setUser(user: unknown) {
  useAuthStore.setState({
    user: user as never,
    constants: null,
    loading: false,
    error: null,
  });
}

// TopNav uses `useAdminGateQuery` (Platform FE Batch 6) so the
// renderer needs a QueryClientProvider in addition to the
// MemoryRouter.
function renderNav(initial = '/dashboard', onLogout = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <TopNav onLogout={onLogout} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TopNav', () => {
  beforeEach(() => {
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  });
  afterEach(() => {
    setUser(null);
  });

  it('shows only brand + theme toggle when unauthenticated', async () => {
    renderNav('/');
    // Auth-gated chrome stays hidden.
    expect(screen.queryByLabelText('Open navigation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Account menu')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Accessibility settings/i)
    ).not.toBeInTheDocument();
    // Brand + theme cycler remain so the landing page isn't bare. Brand
    // name comes from the BE branding query (MSW default = "Aevum");
    // `findBy` waits for the async query to resolve.
    expect(await screen.findByLabelText('Aevum')).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /theme:/i })).toBeInTheDocument();
  });

  it('renders desktop chrome when authenticated (Home + Brand + main links + Settings + user menu)', async () => {
    setUser({
      user_id: 1,
      email_id: 'taylor@example.test',
      first_name: 'Taylor',
      last_name: 'Doe',
    });
    renderNav();
    expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
    expect(await screen.findByLabelText('Aevum')).toHaveAttribute('href', '/');
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
    expect(screen.getByText('Tax Tracker')).toBeInTheDocument();
    expect(screen.getByText('Beneficiaries')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Account menu')).toHaveTextContent('TD');
    expect(screen.getByLabelText('Open navigation')).toBeInTheDocument();
    expect(screen.queryByText('About')).not.toBeInTheDocument();
  });

  it('opens the mobile drawer with all sections + ThemeToggle + Profile + Sign Out', async () => {
    setUser({ user_id: 1, email_id: 'a@b.c', first_name: 'A', last_name: 'B' });
    renderNav();

    fireEvent.click(screen.getByLabelText('Open navigation'));

    const drawer = screen.getByRole('dialog', { name: /navigation menu/i });
    // Brand header inside the drawer. Brand name comes from the BE
    // branding query (MSW default = "Aevum"); await its resolution.
    expect(await within(drawer).findByLabelText('Aevum')).toHaveAttribute(
      'href',
      '/'
    );
    // Dashboard shortcut.
    expect(
      within(drawer).getByRole('link', { name: /Dashboard/i })
    ).toHaveAttribute('href', '/dashboard');
    // MAIN section
    expect(within(drawer).getByText('Main')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('link', { name: 'Transactions' })
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('link', { name: 'Expense Tracker' })
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('link', { name: 'Tax Tracker' })
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('link', { name: 'Beneficiaries' })
    ).toBeInTheDocument();
    // SETTINGS section — Batch 9 moved all three under /settings/*.
    expect(within(drawer).getByText('Settings')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('link', { name: 'Categories' })
    ).toHaveAttribute('href', '/settings/categories');
    expect(
      within(drawer).getByRole('link', { name: 'Categorization Rules' })
    ).toHaveAttribute('href', '/settings/categorization-rules');
    expect(
      within(drawer).getByRole('link', { name: 'Taxation Rules' })
    ).toHaveAttribute('href', '/settings/taxation-rules');
    expect(
      within(drawer).getByRole('link', { name: 'Bank Accounts' })
    ).toHaveAttribute('href', '/settings/bank-accounts');
    // Accessibility section header.
    expect(within(drawer).getByText(/^Accessibility$/i)).toBeInTheDocument();
    // ThemeOptions segmented row (3 icon buttons) — lives inside the
    // lazy-loaded AccessibilityPanel chunk; wait for it to resolve.
    await waitFor(() =>
      expect(
        within(drawer).getByRole('button', { name: /light theme/i })
      ).toBeInTheDocument()
    );
    expect(
      within(drawer).getByRole('button', { name: /dark theme/i })
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: /system theme/i })
    ).toBeInTheDocument();
    // Zoom slider.
    expect(
      within(drawer).getByRole('slider', { name: /Text size/i })
    ).toBeInTheDocument();
    // Reduced motion + Privacy mask toggles (role=switch).
    expect(
      within(drawer).getByRole('switch', { name: /reduce motion/i })
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('switch', { name: /hide amounts/i })
    ).toBeInTheDocument();
    // Account + Sign Out. "Account" links to /account/profile (the
    // default landing tab); the sectioned-page sidebar inside
    // /account/* reveals Profile / Security / Privacy /
    // Accessibility / Preferences. The label changed from "Profile"
    // → "Account" in Batch 9 polish to reflect the broader surface.
    // Use an exact match — "Bank Accounts" (Batch 19+ Settings link
    // added 2026-06-05) also contains "Account".
    expect(
      within(drawer).getByRole('link', { name: 'Account' })
    ).toHaveAttribute('href', '/account/profile');
    expect(
      within(drawer).getByRole('button', { name: /Sign Out/i })
    ).toBeInTheDocument();
  });

  it('drawer Sign Out calls onLogout and closes', () => {
    setUser({ user_id: 1, email_id: 'a@b.c' });
    const onLogout = vi.fn();
    renderNav('/dashboard', onLogout);

    fireEvent.click(screen.getByLabelText('Open navigation'));
    const drawer = screen.getByRole('dialog', { name: /navigation menu/i });
    fireEvent.click(within(drawer).getByRole('button', { name: /Sign Out/i }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('dialog', { name: /navigation menu/i })
    ).not.toBeInTheDocument();
  });

  // Admin-tools link gating is covered by `shared/api/adminGate.test.tsx`
  // (gate logic) + `features/admin/pages/AdminLandingPage.test.tsx`
  // (page-level rendering). The TopNav surface is a thin
  // `{isAdmin && <Link>}` wrapper around the gate query — no
  // dropdown-integration test needed (Radix DropdownMenu's portaled
  // content + happy-dom compose unreliably).

  it('Brand always points at / whenever it is surfaced', async () => {
    setUser({ user_id: 1, email_id: 'a@b.c' });
    const { unmount } = renderNav();
    expect(await screen.findByLabelText('Aevum')).toHaveAttribute('href', '/');
    unmount();

    setUser(null);
    renderNav('/');
    expect(await screen.findByLabelText('Aevum')).toHaveAttribute('href', '/');
  });

  it('Home icon points at /dashboard on desktop', () => {
    setUser({ user_id: 1, email_id: 'a@b.c' });
    renderNav();
    expect(screen.getByLabelText('Dashboard')).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });
});
