import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { MotionToggle } from './MotionToggle';
import { PrivacyToggle } from './PrivacyToggle';
import { ThemeOptions } from './ThemeOptions';
import { ZoomSlider } from './ZoomSlider';

// Desktop-only popover that consolidates the four frontend-persisted
// accessibility controls: theme, text size, reduced motion, and
// privacy mask. Mobile renders the same four rows inline inside the
// drawer.
//
// Built as a small controlled popover (click-outside + Escape) to
// avoid pulling in @radix-ui/react-popover for a single surface. The
// pattern mirrors the pre-Batch-6.5 UserMenu.
//
// Naming: this surface groups everything that's user-pref-local
// (frontend-persisted, no backend sync yet); the data-shape
// preferences like currency / timezone live on the Profile page
// instead. See CONTRIBUTING.md §6 "Accessibility vs Preferences".
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
          <ThemeOptions />
          <ZoomSlider />
          <MotionToggle />
          <PrivacyToggle />
        </div>
      )}
    </div>
  );
}
