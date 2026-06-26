import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

// Shared two-pane shell for top-level "container" pages whose body is
// itself a small router (Settings, Account). Renders a fixed
// breadcrumb, then either a desktop two-column body (sticky sidebar +
// content) at >=lg or a stacked body (horizontal-scroll tab row +
// content) below lg. The active section drives the breadcrumb tail.
//
// Sections plug in by being mounted as nested child routes whose
// parent route's element is a wrapper that renders <SectionedPageLayout>
// (e.g. SettingsLayout / AccountLayout). The child route element
// renders into <Outlet />.

export interface SectionSpec {
  path: string; // absolute path, matched against location.pathname
  label: string;
}

interface SectionedPageLayoutProps {
  rootLabel: string;
  rootHref: string;
  sections: SectionSpec[];
}

function matchSection(pathname: string, section: SectionSpec): boolean {
  return pathname === section.path || pathname.startsWith(`${section.path}/`);
}

export function SectionedPageLayout({
  rootLabel,
  rootHref,
  sections,
}: SectionedPageLayoutProps) {
  const location = useLocation();
  const active = sections.find((s) => matchSection(location.pathname, s));

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <li>
            <Link
              to={rootHref}
              className="hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:text-accent-300 rounded-sm no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {rootLabel}
            </Link>
          </li>
          {active && (
            <>
              <li aria-hidden="true">›</li>
              <li
                aria-current="page"
                className="font-medium text-slate-900 dark:text-slate-100"
              >
                {active.label}
              </li>
            </>
          )}
        </ol>
      </nav>

      {/*
        Mobile / tablet (<lg) — horizontal-scroll tab row pinned under
        the breadcrumb. Touch-friendly chips (>=44px). Overflow scrolls
        horizontally; the surrounding page never side-scrolls because
        the negative margin + padding bleed matches the page's own
        horizontal gutter.
      */}
      <nav
        aria-label={`${rootLabel} sections`}
        className="-mx-3 mb-4 overflow-x-auto px-3 sm:-mx-6 sm:px-6 lg:hidden"
      >
        <ul className="flex min-w-max gap-1 border-b border-slate-200 dark:border-slate-800">
          {sections.map((s) => (
            <li key={s.path}>
              <NavLink to={s.path} end className={mobileTabClass}>
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8">
        {/*
          Desktop (>=lg) sidebar. Sticky inside the page so it stays
          in view as the content area scrolls. top-20 = header (h-16)
          + 1rem breathing room.
        */}
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <nav aria-label={`${rootLabel} sections`}>
            <ul className="flex flex-col gap-1">
              {sections.map((s) => (
                <li key={s.path}>
                  <NavLink to={s.path} end className={sidebarLinkClass}>
                    {s.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function mobileTabClass({ isActive }: { isActive: boolean }): string {
  return [
    'tap-press inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium no-underline transition-colors',
    'border-b-2 -mb-px whitespace-nowrap',
    isActive
      ? 'border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300'
      : 'border-transparent text-slate-600 hover:text-accent-700 hover:border-accent-200 dark:text-slate-300 dark:hover:text-accent-300 dark:hover:border-accent-900/50',
    'focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none rounded-sm',
  ].join(' ');
}

function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'tap-press block rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
    isActive
      ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300'
      : 'text-slate-700 hover:bg-accent-50 hover:text-accent-700 dark:text-slate-200 dark:hover:bg-accent-950/40 dark:hover:text-accent-300',
    'focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none',
  ].join(' ');
}
