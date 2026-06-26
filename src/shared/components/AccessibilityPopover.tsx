import { SlidersHorizontal } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { ACCESSIBILITY_TRIGGER_CLASS } from './accessibilityTriggerClass';

// The Radix Popover surface (+ @radix-ui/react-popover) is deferred so it never
// lands in the first-paint bundle — Radix's positioning / dismissable-layer /
// focus-scope primitives are ~25 kB gz and nothing on first paint needs them.
// Mirrors the Settings/Account menu stub-then-hydrate (TopNav.tsx).
const AccessibilityPopoverSurface = lazy(() =>
  import('./AccessibilityPopoverSurface').then((m) => ({
    default: m.AccessibilityPopoverSurface,
  }))
);

const prefetchSurface = () => import('./AccessibilityPopoverSurface');

// Desktop-only accessibility quick-settings (theme, text size, reduced motion,
// privacy mask, contrast), opened from the TopNav. A stub trigger covers the
// click target until first click; then the lazy surface mounts with the popover
// already open (so the click is honored without a second tap). Hover/focus warms
// the chunk so the first click usually resolves from cache, and the Suspense
// fallback re-renders the SAME stub so the icon never blinks out.
//
// Naming: groups everything user-pref-local (frontend-persisted, no backend
// sync). Data-shape prefs (currency / timezone) live on the Account Preferences
// page — see CONTRIBUTING.md §6 "Accessibility vs Preferences".
export function AccessibilityPopover() {
  const [opened, setOpened] = useState(false);
  if (!opened) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        onMouseEnter={prefetchSurface}
        onFocus={prefetchSurface}
        aria-label="Accessibility settings"
        aria-haspopup="dialog"
        title="Accessibility"
        className={ACCESSIBILITY_TRIGGER_CLASS}
      >
        <SlidersHorizontal aria-hidden="true" size={20} />
      </button>
    );
  }
  return (
    <Suspense
      fallback={
        <button
          type="button"
          aria-label="Accessibility settings"
          title="Accessibility"
          className={ACCESSIBILITY_TRIGGER_CLASS}
        >
          <SlidersHorizontal aria-hidden="true" size={20} />
        </button>
      }
    >
      <AccessibilityPopoverSurface />
    </Suspense>
  );
}
