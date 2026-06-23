import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Settings,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { resolveBrandLogoUrl, useBrandingQuery } from '../api/branding';
import { useAuthStore } from '../state/auth.store';

import { AccessibilityPopover } from './AccessibilityPopover';
import { ActivityBell } from './ActivityBell';
import { ProfileImage } from './ProfileImage';
import { ThemeToggle } from './ThemeToggle';

// The 5 inline accessibility toggles inside the mobile drawer are
// deferred via the same lazy chunk the desktop popover uses — they
// only matter when the drawer is open, which is rare per session
// (the drawer is mobile-only). Frees ~1.5 kB gz from first-paint.
const AccessibilityPanel = lazy(() => import('./AccessibilityPanel'));

// The Radix DropdownMenu surface (Settings + Account menus) is
// deferred — `@radix-ui/react-dropdown-menu` + `@radix-ui/react-popper`
// + `@floating-ui/*` + `react-remove-scroll` aggregate to ~28 kB gz
// and nothing on first paint needs them. Stub buttons cover the
// click target until the chunk lands; on first click the lazy
// module mounts with `defaultOpen` so the menu opens immediately.
const SettingsDropdownLazy = lazy(() =>
  import('./TopNavMenus').then((m) => ({ default: m.SettingsDropdown }))
);
const UserDropdownLazy = lazy(() =>
  import('./TopNavMenus').then((m) => ({ default: m.UserDropdown }))
);

interface TopNavProps {
  onLogout: () => void | Promise<void>;
}

interface NavLinkSpec {
  to: string;
  label: string;
}

// Main feature links — inline on ≥lg, MAIN section in the mobile drawer.
const MAIN_LINKS: NavLinkSpec[] = [
  { to: '/transactions', label: 'Transactions' },
  { to: '/budgets', label: 'Expense Tracker' },
  { to: '/consumption-tax', label: 'Tax Tracker' },
  // "Savings" is the user-facing label; the route + feature stay `treasury`.
  // Sits after Tax Tracker — it's the savings side of the taxation → savings
  // → investments spine.
  { to: '/treasury', label: 'Savings' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/beneficiaries', label: 'Beneficiaries' },
];

// Settings — Radix DropdownMenu on ≥lg, SETTINGS section in the drawer.
// All four live under the /settings/* shell as of Batch 9; legacy
// /categories and /categorization-rules redirect to their /settings/*
// counterparts (see features/settings/settings.routes.tsx). Bank
// Accounts was added 2026-06-05 when the live route turned out to be
// unreachable from the TopNav.
const SETTINGS_LINKS: NavLinkSpec[] = [
  { to: '/settings/categories', label: 'Categories' },
  { to: '/settings/categorization-rules', label: 'Categorization Rules' },
  { to: '/settings/taxation-rules', label: 'Taxation Rules' },
  { to: '/settings/bank-accounts', label: 'Bank Accounts' },
];

// Brand mark — renders the BE-served logo `<img>` when `logoSrc` is
// set; falls back to the Wallet lucide icon (the legacy visual mark)
// otherwise. `onError` swaps back to the icon if the image fails to
// load — so a 404 or transient network glitch doesn't blank the
// brand spot. The image is cached by the browser (same `/media/...`
// host as profile images); no app-side caching needed.
function BrandMark({
  logoSrc,
  brandName,
  size,
}: {
  logoSrc: string | null;
  brandName: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!logoSrc || failed) {
    return <Wallet aria-hidden="true" size={size} />;
  }
  return (
    // jsx-a11y/no-noninteractive-element-interactions: onError isn't
    // user interaction — it's the standard load-failure callback.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      src={logoSrc}
      alt={brandName}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function mainLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'inline-flex items-center px-3 py-2 text-sm font-medium no-underline transition-colors',
    'border-b-2 -mb-px',
    isActive
      ? 'border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300'
      : 'border-transparent text-slate-600 hover:text-accent-700 hover:border-accent-200 dark:text-slate-300 dark:hover:text-accent-300 dark:hover:border-accent-900/50',
    'focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none rounded-sm',
  ].join(' ');
}

function drawerLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'flex min-h-[44px] items-center px-4 py-2 text-sm font-medium no-underline transition-colors',
    isActive
      ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300'
      : 'text-slate-700 hover:bg-accent-50 hover:text-accent-700 dark:text-slate-200 dark:hover:bg-accent-950/40 dark:hover:text-accent-300',
  ].join(' ');
}

export function TopNav({ onLogout }: TopNavProps) {
  const user = useAuthStore((s) => s.user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  // BE Phase 2.11 — single-source brand identity. No hardcoded
  // fallback; `useBrandingQuery` returns the localStorage-cached
  // brand on repeat visits and a neutral empty placeholder on the
  // first-ever visit. See `shared/api/branding.ts`.
  const brand = useBrandingQuery().data;
  const brandName = brand?.name ?? '';
  const brandLogoSrc = resolveBrandLogoUrl(brand?.logo_url);

  // Close the mobile drawer on any route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex h-16 w-full items-center gap-1 px-3 sm:gap-2 sm:px-4 lg:px-6">
          {/*
          Mobile (<lg) top-bar contract:
          [☰] ............................ [👤▾]
          Brand / Home icon / Theme toggle / Settings dropdown all live
          inside the drawer per the 2026-05-26 follow-up plan.
        */}

          {/* Hamburger — visible on <lg, auth-only */}
          {user && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:hidden dark:text-slate-300"
            >
              <Menu aria-hidden="true" size={22} />
            </button>
          )}

          {/* Desktop-only Home icon — → /dashboard. */}
          {user && (
            <Link
              to="/dashboard"
              aria-label="Dashboard"
              title="Dashboard"
              className="hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 hidden h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:inline-flex dark:text-slate-300"
            >
              <Home aria-hidden="true" size={20} />
            </Link>
          )}

          {/*
          Brand — → /. Visibility:
            - Always on ≥lg.
            - On <lg, only when UNauthenticated (otherwise the drawer
              header carries the brand; authed mobile top bar is just
              hamburger + user per the 2026-05-26 spec).
        */}
          <Link
            to="/"
            aria-label={brandName}
            className={`${user ? 'hidden' : 'inline-flex'} text-accent-700 hover:text-accent-800 focus-visible:ring-accent-500 dark:text-accent-300 dark:hover:text-accent-200 items-center gap-2 rounded-md px-1 no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none lg:inline-flex`}
          >
            <BrandMark logoSrc={brandLogoSrc} brandName={brandName} size={22} />
            <span className="hidden text-base font-semibold tracking-tight sm:inline">
              {brandName}
            </span>
          </Link>

          {/* Desktop main-feature links */}
          {user && (
            <nav
              aria-label="Main"
              className="ml-6 hidden items-center gap-1 lg:flex"
            >
              {MAIN_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} className={mainLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {/*
            UNauthenticated users on every viewport get just the
            ThemeToggle cycler — there's no drawer / popover to anchor
            against, and the landing page should still let visitors
            switch theme.
          */}
            {!user && <ThemeToggle />}

            {/*
            Authenticated, desktop-only: a single AccessibilityPopover
            that consolidates theme / text-size / reduced-motion /
            privacy. Mobile users get the same four controls inline in
            the drawer under the "Accessibility" section.
          */}
            {user && (
              <div className="hidden lg:inline-flex">
                <AccessibilityPopover />
              </div>
            )}

            {/*
            Activity bell — desktop only. Click opens a lazy-loaded
            modal with the BE-ranked feed split into Alerts then
            Notifications by event_class. Badge counts current feed
            items capped at "5+". See ActivityBell.tsx for the
            soft/hard-ack discipline.
          */}
            {user && <ActivityBell enabled={Boolean(user)} />}

            {/*
            Help / docs entry-point. Desktop-only — mobile users reach
            the same page via the drawer's footer (placeholder; future
            iteration). Repoint the `to` when a real docs surface
            ships.
          */}
            {user && (
              <Link
                to="/help"
                aria-label="Help"
                title="Help"
                className="hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 hidden h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:inline-flex dark:text-slate-300"
              >
                <HelpCircle aria-hidden="true" size={20} />
              </Link>
            )}

            {user && (
              <>
                {/* Settings dropdown — desktop only. Lazy-loaded Radix
                  surface; stub button covers the click target. */}
                <SettingsMenuLazy />

                {/* User dropdown — both viewports. Mirrors Profile + Sign
                  Out into a 1-tap-from-the-avatar surface even though
                  the same actions are also in the mobile drawer. */}
                <UserMenuLazy user={user} onLogout={onLogout} />
              </>
            )}
          </div>
        </div>
      </header>
      {/*
      Drawer is a sibling of <header>, not a child. The header carries
      `backdrop-blur-sm` which creates a containing block for any
      position:fixed descendant — putting the drawer inside the header
      would anchor `fixed inset-0` to the 4rem-tall header instead of
      the viewport, hiding everything below the brand on scroll.
    */}
      {drawerOpen && user && (
        <MobileDrawer
          onClose={() => setDrawerOpen(false)}
          onLogout={onLogout}
        />
      )}
    </>
  );
}

interface MobileDrawerProps {
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}

// Mobile (<lg) navigation drawer. Carries everything the top bar no
// longer surfaces: brand, dashboard shortcut, MAIN/SETTINGS link
// groups, theme toggle, profile, sign out.
//
// Layout note: the scrollable area is a plain `<div>` (not `<nav>`)
// with explicit `flex-1 min-h-0` so it grows to fill the aside and
// scrolls. Routing semantics are still announced via aria-label on
// the role="dialog" wrapper, so no semantic loss.
function MobileDrawer({ onClose, onLogout }: MobileDrawerProps) {
  const brand = useBrandingQuery().data;
  const brandName = brand?.name ?? '';
  const brandLogoSrc = resolveBrandLogoUrl(brand?.logo_url);
  // Escape closes the drawer — the keyboard equivalent of the scrim
  // click + the explicit Close button. Bound while the drawer is mounted.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className="fixed inset-0 z-40 lg:hidden"
    >
      {/* Scrim — a real button so click-to-dismiss carries native keyboard
          semantics. aria-hidden + tabIndex -1 keep it out of the SR/Tab
          path; keyboard users dismiss via Escape or the visible Close
          button below. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/70"
      />
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Link
            to="/"
            onClick={onClose}
            aria-label={brandName}
            className="text-accent-700 dark:text-accent-300 inline-flex items-center gap-2 no-underline"
          >
            <BrandMark logoSrc={brandLogoSrc} brandName={brandName} size={20} />
            <span className="text-base font-semibold">{brandName}</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <NavLink to="/dashboard" end className={drawerLinkClass}>
            <Home aria-hidden="true" size={16} className="mr-2" />
            Dashboard
          </NavLink>

          <DrawerSection label="Main" links={MAIN_LINKS} />
          <DrawerSection label="Settings" links={SETTINGS_LINKS} />

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          {/*
            Accessibility group — all frontend-persisted UX prefs live
            here. Backend-syncable preferences (currency / country /
            timezone) live on the Profile page instead. See
            CONTRIBUTING.md §6 "Accessibility vs Preferences".

            The label itself is a Link to the full Accessibility page,
            so users who want the page-only controls (link underline,
            focus ring, date/number format, default landing route) can
            reach them in one tap from the drawer. The 5 inline quick
            toggles below stay where they are.
          */}
          <Link
            to="/account/accessibility"
            className="hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 flex min-h-[44px] items-center justify-between px-4 py-1 text-xs font-semibold tracking-wider text-slate-500 uppercase no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400"
          >
            <span>Accessibility</span>
            <ChevronRight aria-hidden="true" size={14} />
          </Link>
          <Suspense
            fallback={
              <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Loading toggles…
              </div>
            }
          >
            <AccessibilityPanel showMoreLink={false} />
          </Suspense>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <Link
            to="/account/profile"
            className={drawerLinkClass({ isActive: false })}
          >
            <UserRound aria-hidden="true" size={16} className="mr-2" />
            Account
          </Link>
          <Link to="/help" className={drawerLinkClass({ isActive: false })}>
            <HelpCircle aria-hidden="true" size={16} className="mr-2" />
            Help
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              void onLogout();
            }}
            className="hover:bg-accent-50 hover:text-accent-700 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 flex min-h-[44px] w-full items-center px-4 py-2 text-left text-sm font-medium text-slate-700 transition-colors dark:text-slate-200"
          >
            <LogOut aria-hidden="true" size={16} className="mr-2" />
            Sign Out
          </button>
        </div>
      </aside>
    </div>
  );
}

interface DrawerSectionProps {
  label: string;
  links: NavLinkSpec[];
}

function DrawerSection({ label, links }: DrawerSectionProps) {
  return (
    <div className="py-1">
      <div className="px-4 py-1 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </div>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={drawerLinkClass}
        >
          {link.label}
        </NavLink>
      ))}
    </div>
  );
}

// Stub-then-hydrate wrappers around the lazy Radix menus. The stub
// button is a 1:1 visual match for Radix's trigger so layout doesn't
// shift when the chunk lands; on first click we set `opened=true`
// which mounts the lazy chunk with `defaultOpen={true}` so the click
// is honored without a second tap.
//
// Two guarantees so the trigger never blinks out (the chunk is ~17.8 kB
// gz and may not be warm yet on an early click):
//   • `prefetchTopNavMenus` on hover/focus warms the chunk the instant
//     the user shows intent — on top of the 2s idle schedule — so the
//     click usually resolves from cache.
//   • the Suspense fallback re-renders the SAME trigger (not `null`), so
//     during any residual load lag the icon stays put instead of
//     vanishing until the Radix surface mounts.
const prefetchTopNavMenus = () => import('./TopNavMenus');

const SETTINGS_TRIGGER_CLASS =
  'hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 hidden h-11 items-center gap-1 rounded-md px-2 text-slate-600 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:inline-flex dark:text-slate-300';

// `onOpen` undefined → presentational (the Suspense fallback while the
// chunk lands); the click is already in flight.
function SettingsTrigger({ onOpen }: { onOpen?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Settings"
      onClick={onOpen}
      onMouseEnter={prefetchTopNavMenus}
      onFocus={prefetchTopNavMenus}
      className={SETTINGS_TRIGGER_CLASS}
    >
      <Settings aria-hidden="true" size={20} />
      <ChevronDown aria-hidden="true" size={14} />
    </button>
  );
}

function SettingsMenuLazy() {
  const [opened, setOpened] = useState(false);
  if (!opened) return <SettingsTrigger onOpen={() => setOpened(true)} />;
  return (
    <Suspense fallback={<SettingsTrigger />}>
      <SettingsDropdownLazy links={SETTINGS_LINKS} defaultOpen />
    </Suspense>
  );
}

interface UserMenuLazyProps {
  user: {
    email_id: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string | null;
  };
  onLogout: () => void | Promise<void>;
}

function UserTrigger({
  user,
  onOpen,
}: {
  user: UserMenuLazyProps['user'];
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Account menu"
      title={user.email_id}
      onClick={onOpen}
      onMouseEnter={prefetchTopNavMenus}
      onFocus={prefetchTopNavMenus}
      className="hover:ring-accent-300 focus-visible:ring-accent-500 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-shadow hover:ring-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
    >
      <ProfileImage
        profileImageUrl={user.profile_image_url ?? null}
        email={user.email_id}
        firstName={user.first_name ?? null}
        lastName={user.last_name ?? null}
        sizeClassName="h-11 w-11"
      />
    </button>
  );
}

function UserMenuLazy({ user, onLogout }: UserMenuLazyProps) {
  const [opened, setOpened] = useState(false);
  if (!opened) return <UserTrigger user={user} onOpen={() => setOpened(true)} />;
  return (
    <Suspense fallback={<UserTrigger user={user} />}>
      <UserDropdownLazy user={user} onLogout={onLogout} defaultOpen />
    </Suspense>
  );
}
