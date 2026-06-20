import { useCallback, useEffect, useRef, useState } from 'react';

import {
  HIGHLIGHT_DURATION_MS,
  scrollHighlightIntoView,
} from '../utils/highlight';

interface UseRowHighlightReturn<T> {
  // The currently-highlighted row id, or null when no highlight is
  // active. Callers compare this against each row's id and feed the
  // result to `highlightClass()` (shared/utils/highlight) to paint the
  // violet glow pulse.
  id: T | null;
  // Trigger the highlight on a new id. Cancels any running timer
  // first so only one row glows at a time.
  flash: (next: T) => void;
}

// "Row highlight on save / deep-link landing" pattern (CONTRIBUTING.md §6).
// Briefly paints a row/card to neutralize the surprise of a modal closing
// into a re-rendered list, or to point the user at one item after a redirect.
// Default 2000 ms — matched to the `highlight-pulse` keyframe so the class
// stays applied for the full glow-and-fade. This hook owns the *state*; the
// *style* (the violet glow pulse) lives in the shared `highlightClass()`
// helper so the look is single-point.
//
// It also **auto-scrolls** the highlighted element to centre (via
// `scrollHighlightIntoView`) from a post-commit effect — so a save that
// reorders/rebuckets the list, or a deep-link via `useDeepLinkHighlight`
// (which calls `flash`), always brings the item to focus at its final
// position. No per-consumer wiring: it finds the element by its
// `highlight-pulse` class.
export function useRowHighlight<T extends string | number>(
  durationMs = HIGHLIGHT_DURATION_MS
): UseRowHighlightReturn<T> {
  const [id, setId] = useState<T | null>(null);
  const timerRef = useRef<number | null>(null);

  const flash = useCallback(
    (next: T) => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      setId(next);
      timerRef.current = window.setTimeout(() => {
        setId(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  // Cancel any pending timer on unmount so stale setState calls don't
  // fire against a torn-down component.
  useEffect(
    () => () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  // Auto-scroll to the freshly-highlighted element. Runs after the commit that
  // set `id` — so the row is at its FINAL position even if the save just
  // reordered the list — and no-ops if it's already fully on screen.
  useEffect(() => {
    if (id == null) return;
    const raf = scrollHighlightIntoView();
    return () => window.cancelAnimationFrame(raf);
  }, [id]);

  return { id, flash };
}
