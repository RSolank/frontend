// Shared trigger styling for the accessibility quick-settings button, so the
// eager stub (AccessibilityPopover) and the lazy Radix surface
// (AccessibilityPopoverSurface) are pixel-identical across the hydration
// boundary. Its own module so neither file imports the other (no eager↔lazy
// cycle that would drag the Radix surface into the first-paint bundle).
export const ACCESSIBILITY_TRIGGER_CLASS =
  'tap-press hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-600 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-slate-400 dark:focus-visible:ring-offset-slate-950';
