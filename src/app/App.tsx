import { Home, Settings } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

import { AuthInit } from '../features/auth/components/AuthInit';
import { useAuth } from '../features/auth/state/useAuth';
import { ThemeToggle } from '../shared/components/ThemeToggle';
import { UserMenu } from '../shared/components/UserMenu';
import { useAuthStore } from '../shared/state/auth.store';

// Root layout for every route. AuthInit lives inside the router because
// it imperatively hydrates the auth store on mount and kicks off the
// preferences fetch. Providers (one level up in main.tsx) handles
// cross-cutting concerns (RQ, error boundary, theme, suspense).
//
// Header layout (authed):
//   [home] Hello, <firstname>                  [theme] [⚙ settings] [avatar]
// Header layout (unauthed):
//   [home]                                                              [theme]
// The Settings gear links to /categories — populated by Batch 4 (tags
// + beneficiaries); until then the route is unmapped and falls through
// the catch-all redirect.
export function App() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const homeHref = user ? '/dashboard' : '/';

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AuthInit />
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex items-center gap-3">
          <Link
            to={homeHref}
            aria-label="Home"
            title="Home"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-indigo-700 no-underline transition-colors hover:bg-indigo-50 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
          >
            <Home aria-hidden="true" size={18} />
          </Link>
          {user?.first_name && (
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Hello, {user.first_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <>
              <Link
                to="/categories"
                aria-label="Settings"
                title="Settings"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
              >
                <Settings aria-hidden="true" size={18} />
              </Link>
              <UserMenu onLogout={logout} />
            </>
          )}
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
