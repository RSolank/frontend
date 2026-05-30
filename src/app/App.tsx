import { Outlet } from 'react-router-dom';

import { AuthInit } from '../features/auth/components/AuthInit';
import { useAuth } from '../features/auth/state/useAuth';
import { TopNav } from '../shared/components/TopNav';
import { useDateFormatStore } from '../shared/state/dateFormat.store';
import { useNumberFormatStore } from '../shared/state/numberFormat.store';

// Root layout for every route. AuthInit hydrates the auth store on mount
// and kicks off the preferences fetch. TopNav is the single navigation
// surface (top-nav-primary, no sidebar) — see Batch 6.5 plan in
// frontend/docs/refactor/implementation_plan.md.
export function App() {
  const { logout } = useAuth();

  // Subscribe to the data-formatter stores so a mode change re-renders
  // every descendant. `formatDate` / `formatMoney` read via getState()
  // (callable outside React), so without an explicit subscription here
  // their consumers would render the new mode only on the next unrelated
  // re-render. Touching the values is enough — React schedules the
  // re-render; we don't need them in any expression.
  useDateFormatStore((s) => s.format);
  useNumberFormatStore((s) => s.format);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AuthInit />
      <TopNav onLogout={logout} />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
