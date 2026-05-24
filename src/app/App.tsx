import { Link, Outlet } from 'react-router-dom';

import { AuthInit } from '../features/auth/components/AuthInit';
import { ThemeToggle } from '../shared/components/ThemeToggle';

// Root layout for every route. The thin header (brand left, ThemeToggle
// right) is the entire app shell for now — feature batches add nav /
// breadcrumbs as they migrate each page. AuthInit lives inside the
// router because it imperatively hydrates the auth store on mount and
// kicks off the preferences fetch (no AuthProvider needed any more —
// useAuthStore replaced the Context in Batch 2). Providers (one level
// up in main.tsx) handles cross-cutting concerns (RQ, error boundary,
// theme, suspense).
export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AuthInit />
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
        <Link
          to="/"
          className="text-sm font-semibold tracking-tight text-slate-900 no-underline transition-colors hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-400"
        >
          Personal Budget
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
