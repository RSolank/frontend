import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Shared chrome for the three primary Dashboard cards. Keeps the
// header / body / footer structure identical across Transactions /
// Expense Tracker / Tax Tracker so the grid reads as a coherent
// triptych even though each card's body is bespoke.
//
// Footer slot is intentionally a `<Link>` (or null) — every card on
// the Dashboard either deep-links to its feature page or has no
// secondary action. Buttons (Add / Generate / etc.) live on the
// destination page's modals per the Batch 6.5 modal-first lock.
interface DashboardCardProps {
  title: string;
  // Right-aligned chip beside the title — e.g. a date range or a
  // count badge. Card-specific.
  titleChip?: ReactNode;
  // The card body. Each card decides its own internal layout.
  children: ReactNode;
  // Optional bottom-right deep link ("View all →"). Omit for cards
  // whose body already contains the relevant action (empty-state CTA).
  footerHref?: string;
  footerLabel?: string;
  // When `true` paints the dashed-border "pending / empty" variant.
  // Cards use this for the fresh-signup empty state.
  pending?: boolean;
  // Optional test id so card-level assertions read cleanly.
  testId?: string;
}

export function DashboardCard({
  title,
  titleChip,
  children,
  footerHref,
  footerLabel,
  pending = false,
  testId,
}: DashboardCardProps) {
  const borderClass = pending
    ? 'border-dashed border-slate-300 dark:border-slate-700'
    : 'border-slate-200 dark:border-slate-800';
  return (
    <section
      data-testid={testId}
      className={`flex h-full flex-col rounded-lg border bg-white p-4 shadow-sm dark:bg-slate-900 ${borderClass}`}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {titleChip ? (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {titleChip}
          </span>
        ) : null}
      </header>
      <div className="flex-1">{children}</div>
      {footerHref && footerLabel ? (
        <footer className="mt-4 text-right">
          <Link
            to={footerHref}
            className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
          >
            {footerLabel} →
          </Link>
        </footer>
      ) : null}
    </section>
  );
}

// Card-internal empty state. Friendly + CTA per the Batch 8.5 design
// answer. Used by all three primary cards when the underlying data
// set is empty (no txns / no budgets / no tax accrual yet).
interface EmptyStateProps {
  // Short, declarative — e.g. "No transactions yet".
  headline: string;
  // Body copy explaining what the CTA will do.
  body: string;
  // Optional primary CTA. Omit for "passive" empties (tax accrual
  // populates on its own as txns land — no actionable button).
  ctaHref?: string;
  ctaLabel?: string;
}

export function DashboardCardEmpty({
  headline,
  body,
  ctaHref,
  ctaLabel,
}: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {headline}
      </p>
      <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
        {body}
      </p>
      {ctaHref && ctaLabel ? (
        <Link
          to={ctaHref}
          className="mt-2 inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

// Skeleton row used while the underlying query is loading. The chrome
// is the same as DashboardCard so layout shift is minimised when the
// real card replaces it.
export function DashboardCardSkeleton({ title }: { title: string }) {
  return (
    <DashboardCard title={title} testId={`dashboard-skeleton-${slug(title)}`}>
      <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
    </DashboardCard>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}
