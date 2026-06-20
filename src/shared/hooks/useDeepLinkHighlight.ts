import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface DeepLinkHighlightOptions {
  // The query param that carries the deep-link target, e.g. 'highlight'
  // (Preferences) or 'template' (Recurring).
  param: string;
  // The page's `flash` from `useRowHighlight`. Passed in (rather than the
  // hook owning its own) so the deep-link shares the SAME highlight state as
  // the page's row-highlight-on-save — one row glows whether it was just
  // saved or just navigated to.
  flash: (value: string) => void;
  // Gate: only fire once the target is actually rendered. If the page shows
  // a loading skeleton first, flashing on the raw mount burns the timer
  // before the element paints (and StrictMode's mount/unmount clears it), so
  // pass the page's ready flag (`!isLoading` / `dataReady`). Default true.
  ready?: boolean;
  // Optional value filter — return false to ignore a value this page doesn't
  // recognise (the param is then left untouched).
  accept?: (value: string) => boolean;
  // Side-effects to run before the flash (e.g. select the tab the target
  // lives in, expand a collapsed section).
  onMatch?: (value: string) => void;
}

// Deep-link "point at this on redirect" (conventions.md → "Row highlight on
// save" → deep-link landing). Reads `?<param>=<value>`, and once the page is
// `ready`, flashes the shared highlight, then **consumes the param**
// (`replace`) so a manual refresh doesn't re-flash — the cue belongs to the
// redirect, not the URL. Reactive to a fresh value: a new navigation that
// re-sets the param re-targets, because consuming the old value lets the next
// one through.
//
// Scrolling the target into view is **not** this hook's job — `flash` feeds
// the shared `useRowHighlight`, whose post-commit effect auto-scrolls the
// `highlight-pulse` element (only if off-screen). So one mechanism handles
// both save-flash and deep-link landings.
export function useDeepLinkHighlight({
  param,
  flash,
  ready = true,
  accept,
  onMatch,
}: DeepLinkHighlightOptions): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(param);
  useEffect(() => {
    if (!value || !ready) return;
    if (accept && !accept(value)) return;
    onMatch?.(value);
    flash(value);
    setSearchParams(
      (prev) => {
        prev.delete(param);
        return prev;
      },
      { replace: true }
    );
    // Re-fire only when the param value or readiness changes; the callbacks
    // (onMatch/flash/accept) are captured at run time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready]);
}
