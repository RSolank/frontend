import { Activity } from 'lucide-react';

import { useMotionStore } from '../state/motion.store';

// Single-line row toggle for the accessibility "Reduce motion" setting.
// Layout mirrors <ThemeOptions /> and <ZoomSlider /> — label on the
// left, control on the right. Uses an iOS-style switch built from a
// plain button so we don't pull in a UI library for one component.
export function MotionToggle() {
  const reducedMotion = useMotionStore((s) => s.reducedMotion);
  const toggle = useMotionStore((s) => s.toggle);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        <Activity aria-hidden="true" size={14} />
        Reduce motion
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={reducedMotion}
        aria-label="Reduce motion"
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900 ${
          reducedMotion
            ? 'bg-indigo-600 dark:bg-indigo-500'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            reducedMotion ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
