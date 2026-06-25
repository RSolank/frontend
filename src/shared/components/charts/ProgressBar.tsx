import { useCountUp } from '../../motion';

// Shared horizontal progress/meter bar. Like the trend charts and donut, the
// fill animates from 0 to its value as the second beat — driven by the
// framer-free `useCountUp`, so it gates on the enclosing card landing (and
// snaps under reduced motion) with zero animation-library weight. Every
// consumer that swaps its hand-rolled bar for this lights up for free.
//
// Renders only the track + fill; callers own any label/legend around it.
export function ProgressBar({
  value,
  fillClass = 'bg-accent-500',
  trackClass = 'bg-slate-200 dark:bg-slate-800',
  className = '',
  ariaLabel,
}: {
  // 0–100; clamped.
  value: number;
  // Tailwind class for the fill (colour). Height comes from the track.
  fillClass?: string;
  // Tailwind class for the track (colour). Height/width tweaks via className.
  trackClass?: string;
  // Extra classes on the track — e.g. a width cap (`max-w-xs`) or height.
  className?: string;
  ariaLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const animated = useCountUp(pct);
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full ${trackClass} ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div className={`h-full ${fillClass}`} style={{ width: `${animated}%` }} />
    </div>
  );
}
