// The "highlight on save / deep-link landing" style fragment (CONTRIBUTING
// §6). Pairs with `shared/hooks/useRowHighlight` — the hook owns the *state*
// (which id is flashing + the ~2s timer), this module owns the *style* (the
// class a row/card paints while flashed).
//
// The effect is a **violet glow pulse** (`highlight-pulse`, defined in
// `index.css`): a ring + soft halo that ramps in fast then fades smoothly
// over 2s, animated on the element's own `box-shadow` (so it survives an
// `overflow-hidden` ancestor — a child overlay would be clipped — and follows
// the element's border-radius natively). Two triggers share it:
//   - **on save** — flash the row that was just created/edited in a list.
//   - **on deep-link landing** — when a redirect points the user at one item
//     (e.g. the dashboard tax-mode banner → `/account/preferences?highlight=
//     tax-mode`), the destination flashes + scrolls that item into view.
//
// The tone is **violet** and, deliberately, **theme-stable** — a single hue
// in both light and dark. The app's `accent` token is theme-flipped (teal /
// indigo) and shared with chrome, so a highlight built on it changed hue per
// theme and blended in. Violet is the constant "pay attention here" signal.
//
// The `variant` parameter is kept for call-site back-compat; the glow overlay
// reads well on both cards and dense rows, so both variants resolve to the
// same class today.

export const HIGHLIGHT_PULSE = 'highlight-pulse';

// How long the highlight stays applied, in ms. **Must match the
// `highlight-pulse` keyframe duration in `index.css` (2s)** — the class is
// removed at this point, so a shorter value chops the animation mid-glow.
// Single-sourced here so `useRowHighlight` and any feature-local highlight
// timer (e.g. CategorizationRulesPage's dual-target machine) can't drift
// apart from the keyframe.
export const HIGHLIGHT_DURATION_MS = 2000;

export type HighlightVariant = 'ring' | 'surface';

// Scroll the highlighted element into view and **centre it** so the "pay
// attention here" item is always brought to focus — even when a save
// **reorders/rebuckets** the list (the row moves but may still be on screen)
// or a deep-link lands on an off-screen target. Pass an explicit `targetId`
// (DOM id) for precision, or omit it to find the element bearing the
// `highlight-pulse` class.
//
// Call this from a **post-commit `useEffect`** (keyed on the highlight id),
// NOT an imperative handler — the effect runs after React commits the
// re-render, so the element is at its FINAL position. An imperative rAF fired
// from the save handler can run before that commit and scroll to the stale
// spot. (The rAF lets layout/expansion settle first.) Returns the rAF handle
// so the caller can cancel it on cleanup.
//
// We always centre (rather than `block: 'nearest'` / a visible-only guard):
// a moved row that's still partly on screen otherwise wouldn't scroll at all,
// which loses the user's place — the whole point is to relocate the item.
export function scrollHighlightIntoView(targetId?: string): number {
  return window.requestAnimationFrame(() => {
    const el = targetId
      ? document.getElementById(targetId)
      : document.querySelector(`.${HIGHLIGHT_PULSE}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/**
 * The highlight class for a row/card, or `''` when it isn't flashing.
 * Concatenate into the element's existing `className`:
 *
 *   className={`... ${highlightClass(isHighlighted)}`}
 *
 * The element should have a `border-radius` for the glow to follow its
 * corners (the overlay uses `border-radius: inherit`).
 */
export function highlightClass(
  highlighted: boolean,
  _variant: HighlightVariant = 'ring'
): string {
  return highlighted ? HIGHLIGHT_PULSE : '';
}
