import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../features/auth/state/useAuth';
import { useBrandingQuery } from '../../shared/api/branding';

// Lazy-load the AuthModal so the (~30 KB) `countries-and-timezones`
// bundle stays in the auth chunk rather than first-paint. Home is
// public, so this keeps the unauthenticated initial download within
// budget.
const AuthModal = lazy(() =>
  import('../../features/auth/components/AuthModal').then((m) => ({
    default: m.AuthModal,
  }))
);

// Landing page. CTAs open the AuthModal (preferred entry path) but
// /login and /register routes remain available for deep links and
// password-manager autofill — see CONTRIBUTING.md §6 "Modal pattern".
export function HomePage() {
  const { user } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const brandName = useBrandingQuery().data?.name ?? 'Aevum';

  // No auto-redirect — authenticated visitors see the landing copy and
  // a single "Go to dashboard" CTA. The Home icon in TopNav is the
  // canonical path back to the app.
  return (
    <div className="relative isolate flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/40" />

      <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.4fr,1fr] lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold tracking-wider text-teal-700 uppercase dark:bg-teal-950/40 dark:text-teal-300">
            Smart budgeting for future you
          </div>

          <h1 className="mb-3 text-4xl leading-tight font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
            See every dollar with{' '}
            <span className="text-teal-700 dark:text-teal-400">clarity</span>.
          </h1>

          <p className="mb-7 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {brandName} keeps your spending, tags, and future tax in one clean
            dashboard. Sign in to pick up where you left off, or create a free
            account to get started in minutes.
          </p>

          <div className="mb-3 flex flex-wrap gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white no-underline shadow-md transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
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
            className="absolute inset-[10%] rounded-3xl bg-gradient-to-br from-sky-200/30 via-emerald-200/20 to-cyan-300/30 blur-2xl"
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
                <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                  +12.4% vs last month
                </div>
              </div>
              <div className="rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
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
