import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../features/auth/state/useAuth';
import type { BudgetCategory } from '../../features/budgets/api/queries';
import type { OverviewTopCategory } from '../../features/budgets/components/ExpenseOverviewCard';
import { useBrandingQuery } from '../../shared/api/branding';
import {
  useIdlePrefetch,
  type PrefetchEntry,
} from '../../shared/utils/prefetchOnIdle';
import { LandingShowcases } from '../components/LandingShowcases';

// Lazy-load the AuthModal so the (~30 KB) `countries-and-timezones`
// bundle stays in the auth chunk rather than first-paint. Home is
// public, so this keeps the unauthenticated initial download within
// budget.
const AuthModal = lazy(() =>
  import('../../features/auth/components/AuthModal').then((m) => ({
    default: m.AuthModal,
  }))
);

// Anonymous landing prefetch — the only click-gated chunk for a
// visitor is the AuthModal (Sign in / Register CTAs). Warm it 2s in
// so the modal opens instantly. Authenticated visitors get TopNav's
// authed schedule instead; the gate below makes this a no-op once
// the user is signed in.
const ANON_PREFETCH: readonly PrefetchEntry[] = [
  {
    load: () => import('../../features/auth/components/AuthModal'),
    delayMs: 2_000,
  },
];

// Hero preview = the REAL Zone-1 overview card, rendered with fabricated data.
// Importing the actual component (lazy, so it stays off first paint) guarantees
// the landing mock can never visually drift from the live expense-tracker page.
const ExpenseOverviewPreview = lazy(() =>
  import('../../features/budgets/components/ExpenseOverviewCard').then((m) => ({
    default: m.ExpenseOverviewView,
  }))
);

const PREVIEW_NOW = new Date();
const PREVIEW_MONTH = `${PREVIEW_NOW.getFullYear()}-${String(
  PREVIEW_NOW.getMonth() + 1
).padStart(2, '0')}`;

// 82,450 / 150,000 = 55% → "On track"; numbers chosen to read as a calm,
// in-control month.
const PREVIEW_TOTAL: BudgetCategory = {
  tag_id: 1,
  tag_name: 'Total Budget',
  tag_type: 'total',
  current_debit: 82_450,
  current_credit: 0,
  current_net_expense: 82_450,
  avg_net_expense: 86_800,
  min_net_expense: 61_000,
  max_net_expense: 98_000,
  limit_amt: 150_000,
  penalty_rate: null,
  default_penalty_rate: null,
};

const PREVIEW_TOP: OverviewTopCategory[] = [
  { tag_id: 11, tag_name: 'Essentials', pctOfTotal: 42 },
  { tag_id: 12, tag_name: 'Dining', pctOfTotal: 18 },
  { tag_id: 13, tag_name: 'Transport', pctOfTotal: 11 },
];

// Landing page. CTAs open the AuthModal (preferred entry path) but
// /login and /register routes remain available for deep links and
// password-manager autofill — see CONTRIBUTING.md §6 "Modal pattern".
export function HomePage() {
  const { user } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);

  // Warm the AuthModal chunk for unauthenticated visitors so the Sign
  // in / Register clicks open the modal without a network round-trip.
  useIdlePrefetch(ANON_PREFETCH, !user);
  // BE Phase 2.11 — single-source brand identity. Empty strings on
  // first-ever visit; localStorage cache replays the last-seen brand
  // on repeat visits. See `shared/api/branding.ts`.
  const brand = useBrandingQuery().data;
  const brandTagline = brand?.tagline ?? '';
  const brandDescription = brand?.description ?? '';

  // No auto-redirect — authenticated visitors see the landing copy and
  // a single "Go to dashboard" CTA. The Home icon in TopNav is the
  // canonical path back to the app.
  return (
    <>
      <div className="relative isolate flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
        <div className="to-accent-50 dark:to-accent-950/40 absolute inset-0 -z-10 bg-gradient-to-br from-sky-50 via-white dark:from-slate-950 dark:via-slate-950" />

        {/*
         * Tailwind arbitrary grid tracks are space-separated — the `_` becomes a
         * space (`grid-template-columns: 1.4fr 1fr`). A comma here would emit
         * invalid CSS (`1.4fr,1fr`), which the browser drops, silently collapsing
         * the hero to one column (text stacked above the card). Keep the
         * underscore.
         */}
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            {brandTagline ? (
              <div className="bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase">
                {brandTagline}
              </div>
            ) : null}

            <h1 className="mb-3 text-4xl leading-tight font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
              See every rupee with{' '}
              <span className="text-accent-700 dark:text-accent-400">
                clarity
              </span>
              .
            </h1>

            {brandDescription ? (
              <p className="mb-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {brandDescription}
              </p>
            ) : null}

            <p className="mb-7 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Sign in to pick up where you left off, or create a free account to
              get started in minutes.
            </p>

            <div className="mb-3 flex flex-wrap gap-3">
              {user ? (
                <Link
                  to="/dashboard"
                  className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white no-underline shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className="focus-visible:ring-accent-500 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
                  >
                    Register
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              No credit card required. You can switch plans or export your data
              any time.
            </p>
          </div>

          <div className="relative p-5">
            <div
              aria-hidden="true"
              className="via-success-200/20 absolute inset-[10%] rounded-3xl bg-gradient-to-br from-sky-200/30 to-cyan-300/30 blur-2xl"
            />
            {/* A subtle desktop upscale gives the card a touch more presence
                without overpowering the (much taller) text column. */}
            <div className="relative origin-center shadow-lg lg:scale-[1.06]">
              <Suspense
                fallback={
                  <div className="h-72 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
                }
              >
                <ExpenseOverviewPreview
                  month={PREVIEW_MONTH}
                  total={PREVIEW_TOTAL}
                  deltaPct={-0.05}
                  topCategories={PREVIEW_TOP}
                  moreCount={0}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      <LandingShowcases />

      {authMode != null && (
        <Suspense fallback={null}>
          <AuthModal
            open
            initialMode={authMode}
            onClose={() => setAuthMode(null)}
          />
        </Suspense>
      )}
    </>
  );
}
