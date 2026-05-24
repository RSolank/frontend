import { Link, Outlet } from 'react-router-dom';

import { ThemeToggle } from '../shared/components/ThemeToggle';
import { AuthProvider } from '../state/AuthContext.jsx';

// Root layout for every route. The thin header (brand left, ThemeToggle
// right) is the entire app shell for now — feature batches add nav /
// breadcrumbs as they migrate each page. AuthProvider sits inside the
// router so useNavigate() in its body resolves; Providers (one level
// up in main.tsx) handles cross-cutting concerns (RQ, error boundary,
// theme, suspense).
export function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
    </AuthProvider>
  );
}
