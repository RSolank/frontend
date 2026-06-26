import { SlidersHorizontal } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { ACCESSIBILITY_TRIGGER_CLASS } from './accessibilityTriggerClass';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

// The 5 toggles are deferred one level further so they only load with this
// surface (which itself only loads on first open).
const AccessibilityPanel = lazy(() => import('./AccessibilityPanel'));

// The Radix Popover surface for the accessibility quick-settings, isolated in a
// lazily-loaded module so `@radix-ui/react-popover` (its dismissable-layer /
// focus-scope / presence / popper primitives) never reaches the first-paint
// bundle — TopNav renders a stub trigger until first click (see
// AccessibilityPopover), then mounts this with the popover already open.
//
// Built on the shared <Popover> (Radix) so it inherits native dismiss (Escape /
// outside-click) + the MENU_SURFACE fade. Controlled `open` is wired through
// `onOpenChange`, so every dismiss path — Escape, outside-click, AND the "More"
// link's `onClose` — closes reliably (the previous hand-rolled controlled
// popover could strand itself open when framer's exit raced navigation).
export function AccessibilityPopoverSurface() {
  const [open, setOpen] = useState(true);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Accessibility settings"
          title="Accessibility"
          className={ACCESSIBILITY_TRIGGER_CLASS}
        >
          <SlidersHorizontal aria-hidden="true" size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        role="dialog"
        aria-label="Accessibility settings"
        className="w-80 py-1"
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
      </PopoverContent>
    </Popover>
  );
}

export default AccessibilityPopoverSurface;
