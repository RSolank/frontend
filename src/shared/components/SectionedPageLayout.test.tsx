import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
} from 'react-router-dom';

import { SectionedPageLayout, type SectionSpec } from './SectionedPageLayout';

const SECTIONS: SectionSpec[] = [
  { path: '/widgets/alpha', label: 'Alpha' },
  { path: '/widgets/beta', label: 'Beta' },
  { path: '/widgets/gamma', label: 'Gamma' },
];

function Shell() {
  return (
    <SectionedPageLayout
      rootLabel="Widgets"
      rootHref="/widgets"
      sections={SECTIONS}
    />
  );
}

const routes: RouteObject[] = [
  {
    path: '/widgets',
    element: <Shell />,
    children: [
      { path: 'alpha', element: <div>Alpha content</div> },
      { path: 'beta', element: <div>Beta content</div> },
      { path: 'gamma', element: <div>Gamma content</div> },
    ],
  },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('SectionedPageLayout', () => {
  it('renders breadcrumb root + active section label', () => {
    renderAt('/widgets/beta');
    const breadcrumb = screen.getByLabelText('Breadcrumb');
    expect(within(breadcrumb).getByRole('link', { name: 'Widgets' })).toHaveAttribute('href', '/widgets');
    expect(within(breadcrumb).getByText('Beta')).toHaveAttribute('aria-current', 'page');
  });

  it('mounts every section in the desktop sidebar AND the mobile tab nav', () => {
    renderAt('/widgets/alpha');
    const navs = screen.getAllByRole('navigation', { name: 'Widgets sections' });
    // One for mobile tabs, one for desktop sidebar — both render in the
    // DOM and CSS hides whichever doesn't match the viewport.
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(within(nav).getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/widgets/alpha');
      expect(within(nav).getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/widgets/beta');
      expect(within(nav).getByRole('link', { name: 'Gamma' })).toHaveAttribute('href', '/widgets/gamma');
    }
  });

  it('renders the matched child route content via <Outlet />', () => {
    renderAt('/widgets/gamma');
    expect(screen.getByText('Gamma content')).toBeInTheDocument();
  });

  it('switches breadcrumb tail when the active route changes', () => {
    const { unmount } = renderAt('/widgets/alpha');
    expect(within(screen.getByLabelText('Breadcrumb')).getByText('Alpha')).toHaveAttribute(
      'aria-current',
      'page'
    );
    unmount();

    renderAt('/widgets/gamma');
    expect(within(screen.getByLabelText('Breadcrumb')).getByText('Gamma')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
