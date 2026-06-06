import { lazy, Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { AuthInit } from '../features/auth/components/AuthInit';
import { useAuth } from '../features/auth/state/useAuth';
import { useBrandingQuery } from '../shared/api/branding';
import { TopNav } from '../shared/components/TopNav';
import { useDateFormatStore } from '../shared/state/dateFormat.store';
import { useNumberFormatStore } from '../shared/state/numberFormat.store';
import { useStatementUploadJobStore } from '../shared/state/statementUploadJob.store';
import { useIdlePrefetch } from '../shared/utils/prefetchOnIdle';

import { AUTHED_PREFETCH } from './idlePrefetchSchedule';

// BE Phase 2.2 — global in-flight statement-upload dock. Lazy so
// the initial-paint bundle stays under the 125 kB ceiling; only
// imported once the user actually has an active job. Hides itself
// on /upload-statement (the page renders the same panel inline).
const StatementUploadDock = lazy(() =>
  import(
    '../features/transactions/statement_upload/components/StatementUploadDock'
  ).then((m) => ({ default: m.StatementUploadDock }))
);

// Root layout for every route. AuthInit hydrates the auth store on mount
// and kicks off the preferences fetch. TopNav is the single navigation
// surface (top-nav-primary, no sidebar) — see Batch 6.5 plan in
// frontend/docs/refactor/implementation_plan.md.
export function App() {
  const { user, logout } = useAuth();
  const activeJobId = useStatementUploadJobStore((s) => s.activeJobId);

  // Warm every click-gated chunk in the TopNav chrome + every
  // primary route chunk on a staggered idle schedule (see
  // `idlePrefetchSchedule.ts`). Gated on auth so an anonymous
  // landing visitor doesn't pay for chunks they can't reach;
  // Home.tsx schedules its own anon entry (AuthModal).
  useIdlePrefetch(AUTHED_PREFETCH, !!user);

  // Subscribe to the data-formatter stores so a mode change re-renders
  // every descendant. `formatDate` / `formatMoney` read via getState()
  // (callable outside React), so without an explicit subscription here
  // their consumers would render the new mode only on the next unrelated
  // re-render. Touching the values is enough — React schedules the
  // re-render; we don't need them in any expression.
  useDateFormatStore((s) => s.format);
  useNumberFormatStore((s) => s.format);

  // BE Phase 2.11 — sync `document.title` + meta description with the
  // single-source brand identity. `index.html` ships neutral
  // placeholders; this effect writes them with the live brand once the
  // network resolves (or the localStorage cache replays — see
  // `shared/api/branding.ts`). Rebrand → one BE record edit → next
  // page load picks it up.
  const brand = useBrandingQuery().data;
  useEffect(() => {
    if (!brand?.name) return;
    document.title = brand.name;
    if (brand.description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', brand.description);
    }
  }, [brand?.name, brand?.description]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AuthInit />
      <TopNav onLogout={logout} />
      <main className="flex-1">
        <Outlet />
      </main>
      {activeJobId !== null && (
        <Suspense fallback={null}>
          <StatementUploadDock />
        </Suspense>
      )}
    </div>
  );
}
