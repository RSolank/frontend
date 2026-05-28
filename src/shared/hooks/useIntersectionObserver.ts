import { useEffect, useRef } from 'react';

interface UseIntersectionObserverOptions {
  // Fired when the sentinel scrolls into view. Caller is responsible
  // for guarding against double-fires (e.g. if a fetch is already
  // in flight).
  onIntersect: () => void;
  // Defaults are a 200px-below-viewport prefetch margin so the next
  // page lands before the user scrolls to the literal bottom.
  rootMargin?: string;
  // When false, the observer is torn down — used by the parent to
  // disable infinite scroll once no more pages exist.
  enabled?: boolean;
}

// IntersectionObserver-backed scroll trigger. Returns a ref to attach
// to a sentinel element near the bottom of the list. When the
// sentinel scrolls into view, `onIntersect` fires.
//
// Sentinel pattern is the modern equivalent of scroll-position math:
// no rAF, no listener attached to window, browser-native off-the-main-
// thread observation. The hook gates re-renders by stashing the
// callback in a ref so the observer is created exactly once per
// `enabled` toggle.
export function useIntersectionObserver({
  onIntersect,
  rootMargin = '200px',
  enabled = true,
}: UseIntersectionObserverOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onIntersect);
  cbRef.current = onIntersect;

  useEffect(() => {
    if (!enabled) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) cbRef.current();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
