import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { Suspense } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { accountRoutes } from './account.routes';

// Smoke tests for the Batch 9 account shell:
//  - /account index redirects to /account/profile
//  - legacy /profile redirects to /account/profile
//  - AccountLayout breadcrumb + sidebar render around each child
//  - the user-dropdown's canonical Profile destination resolves
//
// See settings.routes.test.tsx for why WAIT_TIMEOUT is bumped.
const WAIT_TIMEOUT = 5000;

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderAt(path: string) {
  const router = createMemoryRouter(accountRoutes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={makeClient()}>
      <Suspense fallback={<div data-testid="suspense">loading</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  );
}

async function expectActiveBreadcrumb(label: string) {
  await waitFor(
    () => {
      const breadcrumb = screen.getByLabelText('Breadcrumb');
      expect(within(breadcrumb).getByText(label)).toHaveAttribute(
        'aria-current',
        'page'
      );
    },
    { timeout: WAIT_TIMEOUT }
  );
}

describe('accountRoutes', () => {
  it('/account redirects to /account/profile', async () => {
    renderAt('/account');
    await expectActiveBreadcrumb('Profile');
  });

  it('legacy /profile redirects to /account/profile', async () => {
    renderAt('/profile');
    await expectActiveBreadcrumb('Profile');
  });

  it('shell exposes all five section links', async () => {
    renderAt('/account/privacy');
    await expectActiveBreadcrumb('Privacy');
    const navs = screen.getAllByRole('navigation', {
      name: 'Account sections',
    });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(
        within(nav).getByRole('link', { name: 'Profile' })
      ).toHaveAttribute('href', '/account/profile');
      expect(
        within(nav).getByRole('link', { name: 'Security' })
      ).toHaveAttribute('href', '/account/security');
      expect(
        within(nav).getByRole('link', { name: 'Privacy' })
      ).toHaveAttribute('href', '/account/privacy');
      expect(
        within(nav).getByRole('link', { name: 'Accessibility' })
      ).toHaveAttribute('href', '/account/accessibility');
      expect(
        within(nav).getByRole('link', { name: 'Preferences' })
      ).toHaveAttribute('href', '/account/preferences');
    }
  });
});
