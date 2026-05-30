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
  return (
    pathname === section.path || pathname.startsWith(`${section.path}/`)
  );
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
              className="rounded-sm no-underline transition-colors hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:hover:text-indigo-300"
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
        className="lg:hidden -mx-3 mb-4 overflow-x-auto px-3 sm:-mx-6 sm:px-6"
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
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
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
    'inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium no-underline transition-colors',
    'border-b-2 -mb-px whitespace-nowrap',
    isActive
      ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
      : 'border-transparent text-slate-600 hover:text-indigo-700 hover:border-indigo-200 dark:text-slate-300 dark:hover:text-indigo-300 dark:hover:border-indigo-900/50',
    'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded-sm',
  ].join(' ');
}

function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'block rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
    isActive
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300',
    'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none',
  ].join(' ');
}
