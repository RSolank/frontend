import { forwardRef } from 'react';

// The shared button primitive (T-nav-ia-reorg). Bakes in the app-wide
// `.tap-press` premium tap-feedback token, the focus ring, disabled
// treatment, and `transition-colors` so every button reads consistently —
// the accent token flips per theme (teal light / indigo dark).
//
// This is the INFRA: the recurring + beneficiaries page CTAs are its first
// real consumers; the app-wide `motion-rollout` task migrates the remaining
// raw `<button>`s onto it (wiring, not infra). Nav `NavLink`s can't be a
// `<button>`, so they apply the raw `.tap-press` class directly — the press
// behavior is shared even though the element type isn't.
//
// Deliberately minimal: four variants + two sizes cover current usage. Add a
// variant when a real button needs one, not speculatively.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const BASE =
  'tap-press inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-600 text-white shadow-sm hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-400',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  danger:
    'bg-danger-600 text-white shadow-sm hover:bg-danger-700 dark:bg-danger-500 dark:hover:bg-danger-400',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', type = 'button', className = '', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
});
