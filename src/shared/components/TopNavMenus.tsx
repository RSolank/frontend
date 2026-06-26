import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAdminGateQuery } from '../api/adminGate';

import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu';
import { ProfileImage } from './ProfileImage';

// The desktop user-menu + Settings dropdown are built on the shared <Menu>
// primitive (Radix DropdownMenu + the app-wide MENU_SURFACE fade — see Menu.tsx
// / menuSurface.ts). This module is lazy-loaded so Radix's transitive deps
// (`@radix-ui/react-dropdown-menu` + `@radix-ui/react-popper` + `@floating-ui/*`
// + `react-remove-scroll` + `aria-hidden`, ~28 kB gz) only land when the user
// opens a menu. TopNav renders lightweight stub buttons until first click, then
// mounts this chunk with `defaultOpen` so the click is honored without a second.
//
// Each component renders the full Radix tree (Menu → MenuTrigger → MenuContent).
// After first mount Radix takes over open/close state (uncontrolled, so native
// dismiss keeps working); the lazy chunk stays mounted for the session.

interface NavLinkSpec {
  to: string;
  label: string;
}

interface SettingsDropdownProps {
  links: readonly NavLinkSpec[];
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDropdown({
  links,
  defaultOpen = false,
  onOpenChange,
}: SettingsDropdownProps) {
  return (
    <Menu modal={false} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className="tap-press hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 hidden h-11 items-center gap-1 rounded-md px-2 text-slate-600 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:inline-flex dark:text-slate-300"
        >
          <Settings aria-hidden="true" size={20} />
          <ChevronDown aria-hidden="true" size={14} />
        </button>
      </MenuTrigger>
      <MenuContent className="min-w-[12rem] p-1">
        {links.map((link) => (
          <MenuItem key={link.to} asChild>
            <Link
              to={link.to}
              className="data-[highlighted]:bg-accent-50 data-[highlighted]:text-accent-700 dark:data-[highlighted]:bg-accent-950/40 dark:data-[highlighted]:text-accent-300 block rounded-sm px-3 py-2 text-sm text-slate-700 no-underline outline-none dark:text-slate-200"
            >
              {link.label}
            </Link>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

interface UserDropdownProps {
  user: {
    email_id: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string | null;
  };
  onLogout: () => void | Promise<void>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UserDropdown({
  user,
  onLogout,
  defaultOpen = false,
  onOpenChange,
}: UserDropdownProps) {
  const email = user.email_id;
  // Admin entry — gated on the `role` field surfaced by `/me`
  // (BE T-admin A1, FE Platform Batch 18). `useAdminGateQuery` is
  // a sync read on `useAuthStore.user.role`; no network round-trip.
  const { data: isAdmin = false } = useAdminGateQuery();

  return (
    <Menu modal={false} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          title={email}
          className="tap-press hover:ring-accent-300 focus-visible:ring-accent-500 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-shadow hover:ring-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
        >
          <ProfileImage
            profileImageUrl={user.profile_image_url ?? null}
            email={email}
            firstName={user.first_name ?? null}
            lastName={user.last_name ?? null}
            sizeClassName="h-11 w-11"
          />
        </button>
      </MenuTrigger>
      <MenuContent className="min-w-[14rem] p-1">
        <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Signed in as
          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {email}
          </div>
        </div>
        <MenuItem asChild>
          <Link
            to="/account/profile"
            className="data-[highlighted]:bg-accent-50 data-[highlighted]:text-accent-700 dark:data-[highlighted]:bg-accent-950/40 dark:data-[highlighted]:text-accent-300 flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-slate-700 no-underline outline-none dark:text-slate-200"
          >
            <UserRound aria-hidden="true" size={14} />
            Account
          </Link>
        </MenuItem>
        {isAdmin && (
          <MenuItem asChild>
            <Link
              to="/admin"
              data-testid="topnav-admin-link"
              className="data-[highlighted]:bg-accent-50 data-[highlighted]:text-accent-700 dark:data-[highlighted]:bg-accent-950/40 dark:data-[highlighted]:text-accent-300 flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-slate-700 no-underline outline-none dark:text-slate-200"
            >
              <Settings aria-hidden="true" size={14} />
              Admin tools
            </Link>
          </MenuItem>
        )}
        <MenuItem asChild>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="data-[highlighted]:bg-accent-50 data-[highlighted]:text-accent-700 dark:data-[highlighted]:bg-accent-950/40 dark:data-[highlighted]:text-accent-300 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-slate-700 outline-none dark:text-slate-200"
          >
            <LogOut aria-hidden="true" size={14} />
            Sign Out
          </button>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
