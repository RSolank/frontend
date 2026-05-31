import { SlidersHorizontal } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

// The 5 toggles inside the popover are deferred into a lazy chunk —
// only loaded when the user opens this surface. Frees the first-
// paint bundle of ~1.5 kB gz (CONTRIBUTING.md §3 ratchet, Platform
// FE Batch 5).
const AccessibilityPanel = lazy(() => import('./AccessibilityPanel'));

// Desktop-only popover with the five most-flipped accessibility
// controls: theme, text size, reduced motion, privacy mask, and
// high contrast. The remaining surfaces (underline links, always-
// show focus, plus the three data-formatting selects) live on the
// canonical /account/accessibility page only — those are set-once,
// not flipped mid-task. A "More" link at the bottom of the popover
// jumps to the full page.
//
// Built as a small controlled popover (click-outside + Escape) to
// avoid pulling in @radix-ui/react-popover for a single surface. The
// pattern mirrors the pre-Batch-6.5 UserMenu.
//
// Naming: this surface groups everything that's user-pref-local
// (frontend-persisted, no backend sync yet); the data-shape
// preferences like currency / timezone live on the Account
// Preferences page instead. See CONTRIBUTING.md §6 "Accessibility
// vs Preferences".
export function AccessibilityPopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Accessibility settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Accessibility"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
      >
        <SlidersHorizontal aria-hidden="true" size={20} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Accessibility settings"
          className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-slate-200 bg-white py-1 shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <Suspense
            fallback={
              <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Loading…
              </div>
            }
          >
            <AccessibilityPanel onClose={() => setOpen(false)} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
