import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../features/auth/state/useAuth';
import { useBrandingQuery } from '../../shared/api/branding';
import {
  useIdlePrefetch,
  type PrefetchEntry,
} from '../../shared/utils/prefetchOnIdle';

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
            See every dollar with{' '}
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
          <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="mb-0.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Monthly overview
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ₹82,450
                </div>
                <div className="text-success-600 dark:text-success-400 mt-0.5 text-xs">
                  +12.4% vs last month
                </div>
              </div>
              <div className="bg-success-100/70 text-success-800 dark:bg-success-950/40 dark:text-success-300 rounded-full px-3 py-1 text-xs font-semibold">
                On track
              </div>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2">
              {[
                { label: 'Essentials', value: '42%', tint: 'bg-teal-500' },
                { label: 'Goals & tax', value: '28%', tint: 'bg-blue-500' },
                { label: 'Lifestyle', value: '30%', tint: 'bg-purple-500' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="mb-0.5 text-[0.7rem] text-slate-500 dark:text-slate-400">
                    {item.label}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.value}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${item.tint}`}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-300 pt-3 dark:border-slate-700">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Next tax set-aside
                </div>
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  ₹14,300
                </div>
              </div>
              <div className="max-w-[11rem] text-right text-[0.7rem] text-slate-500 dark:text-slate-400">
                Automatically tagged so you do not have to think about it.
              </div>
            </div>
          </div>
        </div>
      </div>

      {authMode != null && (
        <Suspense fallback={null}>
          <AuthModal
            open
            initialMode={authMode}
            onClose={() => setAuthMode(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
