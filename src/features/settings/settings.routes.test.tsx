import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { Suspense } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { settingsRoutes } from './settings.routes';

// Smoke tests for the Batch 9 settings shell:
//  - /settings index redirects to /settings/categories
//  - SettingsLayout breadcrumb + sidebar render around each child
//
// No tests for legacy /categories or /categorization-rules redirects —
// those redirect routes were retired in this batch (no in-app surface
// links to them; external bookmarks fall through the `*` catch-all).
//
// The shell mounts the real (lazy) feature pages via settings.routes;
// we wrap in <Suspense> so the import promises resolve, and supply a
// QueryClient because every page's TanStack-Query hooks need one.
//
// `WAIT_TIMEOUT` is bumped above the testing-library default (1000ms)
// because the lazy chunks race against the full-suite scheduling; with
// the default a parallel-suite run occasionally flakes on the first
// breadcrumb assertion (~50ms over budget under load).
const WAIT_TIMEOUT = 5000;

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderAt(path: string) {
  const router = createMemoryRouter(settingsRoutes, { initialEntries: [path] });
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

describe('settingsRoutes', () => {
  it('/settings redirects to /settings/categories', async () => {
    renderAt('/settings');
    await expectActiveBreadcrumb('Categories');
  });

  it('shell exposes all sidebar links at their canonical /settings/* paths', async () => {
    renderAt('/settings/taxation-rules');
    await expectActiveBreadcrumb('Taxation Rules');
    const navs = screen.getAllByRole('navigation', {
      name: 'Settings sections',
    });
    expect(navs).toHaveLength(2); // mobile + desktop, both in DOM
    for (const nav of navs) {
      expect(
        within(nav).getByRole('link', { name: 'Categories' })
      ).toHaveAttribute('href', '/settings/categories');
      expect(
        within(nav).getByRole('link', { name: 'Categorization Rules' })
      ).toHaveAttribute('href', '/settings/categorization-rules');
      expect(
        within(nav).getByRole('link', { name: 'Taxation Rules' })
      ).toHaveAttribute('href', '/settings/taxation-rules');
      expect(
        within(nav).getByRole('link', { name: 'Bank Accounts' })
      ).toHaveAttribute('href', '/settings/bank-accounts');
    }
  });
});
