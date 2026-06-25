import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../features/auth/state/useAuth';
import type { TreasuryTrendPoint } from '../../features/treasury/api/queries';
import { useBrandingQuery } from '../../shared/api/branding';
import { useMoneyFormatter } from '../../shared/hooks/useMoneyFormatter';
import { Stagger, StaggerItem } from '../../shared/motion';
import {
  useIdlePrefetch,
  type PrefetchEntry,
} from '../../shared/utils/prefetchOnIdle';
import { useLoadOnApproach } from '../../shared/utils/useLoadOnApproach';

// Lazy-load the AuthModal so the (~30 KB) `countries-and-timezones`
// bundle stays in the auth chunk rather than first-paint. Home is
// public, so this keeps the unauthenticated initial download within
// budget.
const AuthModal = lazy(() =>
  import('../../features/auth/components/AuthModal').then((m) => ({
    default: m.AuthModal,
  }))
);

// Below-the-fold showcase strip — lazy so its framer-motion + chart code
// stays OUT of the landing's first-paint chunk. Warmed on idle (prefetch
// below) so it's ready by the time the visitor scrolls; it scroll-reveals
// via <Reveal> once on screen.
const LandingShowcases = lazy(() =>
  import('../components/LandingShowcases').then((m) => ({
    default: m.LandingShowcases,
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

// Hero preview = the REAL Savings-page visuals, rendered with fabricated data.
// The hero leads with the product's differentiator — self-tax → real savings —
// so it shows the headline metric (set-aside balance + coverage) over the
// cumulative set-aside trend. Importing the actual components (lazy, so they
// stay off first paint) guarantees the landing mock can never drift from the
// live Savings page.
const SavingsHeadlinePreview = lazy(() =>
  import('../../features/treasury/components/SavingsHeadline').then((m) => ({
    default: m.SavingsHeadline,
  }))
);
const SavingsTrendPreview = lazy(() =>
  import('../../features/treasury/components/SavingsTrend').then((m) => ({
    default: m.SavingsTrend,
  }))
);

// Savings hero fixture — internally consistent so the numbers reconcile:
// funded (set aside) = 48,200, coverage = 48,200 / 61,000 ≈ 79%, and the
// trend's final cumulative balance lands on the same 48,200.
const HERO_FUNDED = 48_200;
const HERO_PROVISIONED = 61_000;
// Compounding curve — starts near half the final balance and the per-step gain
// itself grows each week, so the line rises slowly then picks up pace toward the
// destination (sets up the "committee invests it" story). Final cumulative lands
// on the funded balance above.
const HERO_TREND: TreasuryTrendPoint[] = [
  { period_end: '2026-01-04', cumulative_balance: 24_000, delta: 24_000 },
  { period_end: '2026-01-11', cumulative_balance: 25_600, delta: 1_600 },
  { period_end: '2026-01-18', cumulative_balance: 28_000, delta: 2_400 },
  { period_end: '2026-01-25', cumulative_balance: 31_700, delta: 3_700 },
  { period_end: '2026-02-01', cumulative_balance: 37_800, delta: 6_100 },
  { period_end: '2026-02-08', cumulative_balance: 48_200, delta: 10_400 },
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
  // Load the below-the-fold showcases on first-of { a timer from page-load,
  // the strip scrolling near view } — so they're ready before the scroll
  // without weighing on first paint, and never gated purely on the scroll.
  const showcases = useLoadOnApproach();
  // BE Phase 2.11 — single-source brand identity. Empty strings on
  // first-ever visit; localStorage cache replays the last-seen brand
  // on repeat visits. See `shared/api/branding.ts`.
  const brand = useBrandingQuery().data;
  const brandTagline = brand?.tagline ?? '';
  const brandDescription = brand?.description ?? '';
  // Formatter for the savings hero's headline metric (pure SavingsHeadline
  // takes `money` as a prop). Resolves the runtime currency symbol; falls back
  // gracefully before the public currencies query settles.
  const { money } = useMoneyFormatter();

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
          {/* Framer cascade entrance — `domAnimation` is injected EAGERLY at
              the app root (app/providers.tsx) so this above-the-fold hero
              animates on first paint instead of waiting on a lazy chunk. Each
              line fades + rises in sequence; reduced motion snaps (MotionConfig
              + StaggerItem both honor the in-app toggle + OS preference). */}
          <Stagger>
            {brandTagline ? (
              <StaggerItem>
                <div className="bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase">
                  {brandTagline}
                </div>
              </StaggerItem>
            ) : null}

            <StaggerItem>
              <h1 className="mb-3 text-4xl leading-tight font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
                Every spend sets a little aside for{' '}
                <span className="text-accent-700 dark:text-accent-400">
                  future you
                </span>
                .
              </h1>
            </StaggerItem>

            {brandDescription ? (
              <StaggerItem>
                <p className="mb-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {brandDescription}
                </p>
              </StaggerItem>
            ) : null}

            <StaggerItem>
              <p className="mb-7 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Sign in to pick up where you left off, or create a free account
                to get started in minutes.
              </p>
            </StaggerItem>

            <StaggerItem>
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
            </StaggerItem>

            <StaggerItem>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No credit card required. You can switch plans or export your
                data any time.
              </p>
            </StaggerItem>
          </Stagger>

          <div className="relative p-5">
            <div
              aria-hidden="true"
              className="via-success-200/20 absolute inset-[10%] rounded-3xl bg-gradient-to-br from-emerald-200/30 to-cyan-300/30 blur-2xl dark:from-emerald-900/20 dark:to-cyan-900/20"
            />
            {/* The real Savings visuals (headline metric over the set-aside
                trend), each a beat in the cascade — the headline rises, then
                the trend rises and draws in (its StaggerItem settled signal
                drives the chart's two-beat draw). A subtle desktop upscale
                gives the pair presence without overpowering the text column. */}
            <Stagger className="relative flex origin-center flex-col gap-4 lg:scale-[1.02]">
              <StaggerItem>
                <Suspense
                  fallback={
                    <div className="h-40 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
                  }
                >
                  <SavingsHeadlinePreview
                    fundedBalance={HERO_FUNDED}
                    provisionedTotal={HERO_PROVISIONED}
                    money={money}
                  />
                </Suspense>
              </StaggerItem>
              <StaggerItem>
                <Suspense
                  fallback={
                    <div className="h-56 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
                  }
                >
                  <SavingsTrendPreview trend={HERO_TREND} />
                </Suspense>
              </StaggerItem>
            </Stagger>
          </div>
        </div>
      </div>

      <div ref={showcases.ref}>
        {showcases.ready ? (
          <Suspense fallback={null}>
            <LandingShowcases />
          </Suspense>
        ) : null}
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
    </>
  );
}
