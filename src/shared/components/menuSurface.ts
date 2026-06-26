// The single source of truth for floating menu/popover SURFACE chrome + the
// open/close fade (T-nav-ia-reorg shared primitive). Both Radix DropdownMenu
// (<Menu>) and Radix Popover (<Popover>) expose `data-[state]=open|closed`, so
// the same class string drives the fade for every dropdown in the app — change
// the look or the fade timing here and all of them update (the divergence that
// let the accessibility popover break while Settings/Account worked is gone).
//
// Fade-only (no transform) so it never fights Radix's Popper positioning. Radix
// Presence holds the node through `data-[state=closed]` so the exit plays before
// unmount. Reduced motion: the global `html.reduce-motion *` reset zeroes the
// `animate-in/out` (see index.css). Padding/width are NOT included — consumers
// add `p-1` (menu) / `py-1` (control popover) so one surface serves both.
export const MENU_SURFACE =
  'z-50 rounded-md border border-slate-200 bg-white shadow-md ' +
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-150 ' +
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100 ' +
  'dark:border-slate-800 dark:bg-slate-900';
