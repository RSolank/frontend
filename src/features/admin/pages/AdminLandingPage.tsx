import { Link } from 'react-router-dom';

import { useAdminGateQuery } from '../../../shared/api/adminGate';

// Admin portal landing — currently a scaffold. BE Phase 1.11 shipped
// the `Role` enum + `require_role(ADMIN)` guard; T-admin A1
// (`2c47fa9`, FE Platform Batch 18) surfaced `role` on `/me` so the
// gate is now a sync store read instead of an `/admin/ping` probe.
// Concrete admin endpoints (user list, ops tools, cemetery audit)
// land across T-admin Phases A2-D1; this page becomes the dashboard
// linking out to per-tool sub-routes once they ship.
//
// Routing: mounted at `/admin/*` inside ProtectedRoute. The gate
// also runs here as a second-line defence — direct URL access by a
// non-admin (who somehow guessed `/admin`) gets the "not available"
// panel instead of a router-level 404 redirect.
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
        <div className="rounded-xl border border-danger-300 bg-danger-50/40 p-6 dark:border-danger-900/60 dark:bg-danger-950/20">
          <h1 className="text-lg font-semibold text-danger-700 dark:text-danger-300">
            Not available
          </h1>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            The admin portal is only available to operators. If you
            think you should have access, contact support.
          </p>
          <Link
            to="/dashboard"
            className="mt-3 inline-flex text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
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
            /me
          </code>{' '}
          reported{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
            role: &quot;admin&quot;
          </code>{' '}
          for your account. Non-admin callers see the &ldquo;Not
          available&rdquo; panel instead — the user-dropdown link is
          gated on the same flag.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Available tools
        </h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link
              to="/admin/users"
              className="font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              User list + search
            </Link>
            <span className="text-slate-500 dark:text-slate-400">
              {' '}
              — paginated inventory of every non-SYSTEM account.
              Click a user to view sessions/devices/activity and
              lock or force-logout the account.
            </span>
          </li>
          <li>
            <Link
              to="/admin/cemetery"
              className="font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              Cemetery audit
            </Link>
            <span className="text-slate-500 dark:text-slate-400">
              {' '}
              — post-purge tombstones with retained replica counts.
            </span>
          </li>
          <li>
            <Link
              to="/admin/ops/bill-backfill"
              className="font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              Bill backfill
            </Link>
            <span className="text-slate-500 dark:text-slate-400">
              {' '}
              — generate consumption-tax bills for a user over an
              arbitrary date range (bypasses the auto-mode guard).
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
