import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ChevronDown,
  Home,
  LogOut,
  Menu,
  Settings,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { useAuthStore } from '../state/auth.store';

import { AccessibilityPopover } from './AccessibilityPopover';
import { ContrastToggle } from './ContrastToggle';
import { MotionToggle } from './MotionToggle';
import { PrivacyToggle } from './PrivacyToggle';
import { ThemeOptions } from './ThemeOptions';
import { ThemeToggle } from './ThemeToggle';
import { ZoomSlider } from './ZoomSlider';

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
  { to: '/beneficiaries', label: 'Beneficiaries' },
];

// Settings — Radix DropdownMenu on ≥lg, SETTINGS section in the drawer.
// All three live under the /settings/* shell as of Batch 9; legacy
// /categories and /categorization-rules redirect to their /settings/*
// counterparts (see features/settings/settings.routes.tsx).
const SETTINGS_LINKS: NavLinkSpec[] = [
  { to: '/settings/categories', label: 'Categories' },
  { to: '/settings/categorization-rules', label: 'Categorization Rules' },
  { to: '/settings/taxation-rules', label: 'Taxation Rules' },
];

function initialsFor(email: string, firstName?: string, lastName?: string) {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return (email[0] ?? '?').toUpperCase();
}

function mainLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'inline-flex items-center px-3 py-2 text-sm font-medium no-underline transition-colors',
    'border-b-2 -mb-px',
    isActive
      ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
      : 'border-transparent text-slate-600 hover:text-indigo-700 hover:border-indigo-200 dark:text-slate-300 dark:hover:text-indigo-300 dark:hover:border-indigo-900/50',
    'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded-sm',
  ].join(' ');
}

function drawerLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'flex min-h-[44px] items-center px-4 py-2 text-sm font-medium no-underline transition-colors',
    isActive
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300',
  ].join(' ');
}

export function TopNav({ onLogout }: TopNavProps) {
  const user = useAuthStore((s) => s.user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

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
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none lg:hidden dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
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
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none lg:inline-flex dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
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
          aria-label="Personal Budget"
          className={`${user ? 'hidden' : 'inline-flex'} items-center gap-2 rounded-md px-1 text-indigo-700 no-underline transition-colors hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none lg:inline-flex dark:text-indigo-300 dark:hover:text-indigo-200`}
        >
          <Wallet aria-hidden="true" size={22} />
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Personal Budget
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

          {user && (
            <>
              {/* Settings dropdown — desktop only */}
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Settings"
                    className="hidden h-11 items-center gap-1 rounded-md px-2 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none lg:inline-flex dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                  >
                    <Settings aria-hidden="true" size={20} />
                    <ChevronDown aria-hidden="true" size={14} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 min-w-[12rem] rounded-md border border-slate-200 bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    {SETTINGS_LINKS.map((link) => (
                      <DropdownMenu.Item key={link.to} asChild>
                        <Link
                          to={link.to}
                          className="block rounded-sm px-3 py-2 text-sm text-slate-700 no-underline outline-none data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 dark:text-slate-200 dark:data-[highlighted]:bg-indigo-950/40 dark:data-[highlighted]:text-indigo-300"
                        >
                          {link.label}
                        </Link>
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* User dropdown — both viewports. Mirrors Profile + Sign
                  Out into a 1-tap-from-the-avatar surface even though
                  the same actions are also in the mobile drawer. */}
              <UserDropdown user={user} onLogout={onLogout} />
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className="fixed inset-0 z-40 lg:hidden"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/70"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Link
            to="/"
            onClick={onClose}
            aria-label="Personal Budget"
            className="inline-flex items-center gap-2 text-indigo-700 no-underline dark:text-indigo-300"
          >
            <Wallet aria-hidden="true" size={20} />
            <span className="text-base font-semibold">Personal Budget</span>
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
          */}
          <div className="px-4 py-1 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Accessibility
          </div>
          <ThemeOptions />
          <ZoomSlider />
          <MotionToggle />
          <PrivacyToggle />
          <ContrastToggle />

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <Link
            to="/account/profile"
            className={drawerLinkClass({ isActive: false })}
          >
            <UserRound aria-hidden="true" size={16} className="mr-2" />
            Account
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              void onLogout();
            }}
            className="flex min-h-[44px] w-full items-center px-4 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
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

interface UserDropdownProps {
  user: { email_id: string; first_name?: string; last_name?: string };
  onLogout: () => void | Promise<void>;
}

function UserDropdown({ user, onLogout }: UserDropdownProps) {
  const email = user.email_id;
  const initials = initialsFor(email, user.first_name, user.last_name);

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          title={email}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-slate-950"
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[14rem] rounded-md border border-slate-200 bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Signed in as
            <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {email}
            </div>
          </div>
          <DropdownMenu.Item asChild>
            <Link
              to="/account/profile"
              className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-slate-700 no-underline outline-none data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 dark:text-slate-200 dark:data-[highlighted]:bg-indigo-950/40 dark:data-[highlighted]:text-indigo-300"
            >
              <UserRound aria-hidden="true" size={14} />
              Account
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-slate-700 outline-none data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 dark:text-slate-200 dark:data-[highlighted]:bg-indigo-950/40 dark:data-[highlighted]:text-indigo-300"
            >
              <LogOut aria-hidden="true" size={14} />
              Sign Out
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
