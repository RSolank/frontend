// The "row highlight on save / deep-link landing" style fragment (CONTRIBUTING
// §6). Pairs with `shared/hooks/useRowHighlight` — the hook owns the *state*
// (which row id is flashing + the ~1.5s fade timer), this module owns the
// *style* (the ring/surface classes a row paints while flashed).
//
// The tone is **violet** and, deliberately, **theme-stable** — a single hue in
// both light and dark (no `dark:` ring variant). The app's `accent` token is
// theme-flipped (teal in light, indigo in dark) and is shared with chrome
// (buttons, links, active tabs), so a highlight built on it changed hue per
// theme and blended into the UI. Violet is the "pay attention here" signal —
// the same family as the interactive `RecurringChip` — kept constant so the
// glow reads the same everywhere.
//
// Two variants:
//   - `ring`    — the ring alone, painted inset on the row's own border box.
//   - `surface` — ring plus a faint background tint, for rows that also wash
//                 the whole row background while highlighted.
// Both are `ring-inset` so the ring lands on the element's existing rounded
// border rather than spilling outside it.

export const HIGHLIGHT_RING = 'ring-2 ring-violet-500 ring-inset';

export const HIGHLIGHT_SURFACE = `${HIGHLIGHT_RING} bg-violet-50/60 dark:bg-violet-950/30`;

export type HighlightVariant = 'ring' | 'surface';

/**
 * The highlight class for a row, or `''` when it isn't flashing. Concatenate
 * into the row's existing `className`:
 *
 *   className={`... ${highlightClass(isHighlighted)}`}
 *   className={`... ${highlightClass(isHighlighted, 'surface')}`}
 */
export function highlightClass(
  highlighted: boolean,
  variant: HighlightVariant = 'ring'
): string {
  if (!highlighted) return '';
  return variant === 'surface' ? HIGHLIGHT_SURFACE : HIGHLIGHT_RING;
}
