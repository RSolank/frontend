import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Shared chrome for every dashboard hero card so Provision / Savings / Spend
// read as one family: a rounded, slightly elevated panel with an eyebrow label
// row (optional deep-link on the right) above the card body. Purely
// presentational — entrance motion is choreographed one level up by the
// DashboardHero zone, so the shell stays a plain section.
export function HeroShell({
  eyebrow,
  footer,
  testId,
  children,
  className = '',
}: {
  eyebrow: ReactNode;
  footer?: { href: string; label: string };
  testId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-testid={testId}
      className={`flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {eyebrow}
        </span>
        {footer ? (
          <Link
            to={footer.href}
            className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 shrink-0 text-xs font-medium transition-colors"
          >
            {footer.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
