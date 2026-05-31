import { Link } from 'react-router-dom';

import { useAdminGateQuery } from '../../../shared/api/adminGate';

// Admin portal landing — currently a scaffold. BE Phase 1.11 ships
// the access gate (`GET /api/admin/ping`) + the `Role` enum, but no
// concrete admin endpoints yet (the user-list / ops tools land in a
// later BE phase). When those endpoints ship, this page becomes the
// dashboard linking out to per-tool sub-routes.
//
// Routing: mounted at `/admin/*` inside ProtectedRoute. The gate
// query also runs here as a second-line defence — direct URL access
// by a non-admin (who somehow guessed `/admin`) gets the "not
// available" panel instead of a router-level 404 redirect.
export function AdminLandingPage() {
  const { data: isAdmin, isLoading } = useAdminGateQuery();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        Checking access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-rose-300 bg-rose-50/40 p-6 dark:border-rose-900/60 dark:bg-rose-950/20">
          <h1 className="text-lg font-semibold text-rose-700 dark:text-rose-300">
            Not available
          </h1>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            The admin portal is only available to operators. If you
            think you should have access, contact support.
          </p>
          <Link
            to="/dashboard"
            className="mt-3 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Admin tools
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Operator-only surface. Backend admin endpoints land in
          later phases; until then this page is a scaffold confirming
          the access gate works.
        </p>
      </header>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Access gate (live)
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          You reached this page because{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
            GET /api/admin/ping
          </code>{' '}
          returned 200 for your account. Non-admin callers get 403
          and never see this surface — the user-dropdown link is
          also gated on the same probe.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Coming soon
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>User list + role assignment</li>
          <li>Operational metrics + worker queue inspection</li>
          <li>Cemetery / soft-delete audit trail</li>
        </ul>
      </div>
    </div>
  );
}
