import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuthStore } from '../state/auth.store';

interface UserMenuProps {
  // Logout action is owned by features/auth/state/useAuth (it composes the
  // store reset with react-router's useNavigate); UserMenu lives in
  // shared/ and therefore can't import it directly, so the caller passes
  // it in. App.tsx wires this up at mount.
  onLogout: () => void | Promise<void>;
}

function initialsFor(email: string, firstName?: string, lastName?: string) {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return (email[0] ?? '?').toUpperCase();
}

export function UserMenu({ onLogout }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside-aware close. The native <details>/<summary> pair handles
  // outside-click inconsistently across browsers; an explicit listener is
  // simpler and accessible. Escape also closes the menu.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const email = user.email_id;
  const initials = initialsFor(email, user.first_name, user.last_name);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={email}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-slate-950"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Signed in as
            <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {email}
            </div>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 no-underline transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-200 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
          >
            <UserRound aria-hidden="true" size={14} />
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void onLogout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-200 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
          >
            <LogOut aria-hidden="true" size={14} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
