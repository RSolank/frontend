import { useCallback, useEffect, useRef, useState } from 'react';

interface UseRowHighlightReturn<T> {
  // The currently-highlighted row id, or null when no highlight is
  // active. Callers compare this against each row's id to decide
  // whether to paint the indigo ring.
  id: T | null;
  // Trigger the highlight on a new id. Cancels any running timer
  // first so only one row glows at a time.
  flash: (next: T) => void;
}

// "Row highlight on save" pattern (CONTRIBUTING.md §6). Briefly paints
// a row to neutralize the surprise of a modal closing into a
// re-rendered list. ~1500 ms default fade.
export function useRowHighlight<T extends string | number>(
  durationMs = 1500
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

  return { id, flash };
}
