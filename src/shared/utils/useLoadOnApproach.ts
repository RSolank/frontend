import { type RefObject, useEffect, useRef, useState } from 'react';

// Defers a below-the-fold subtree until it's actually needed, then loads it on
// whichever happens FIRST:
//   - a fixed timer that starts at mount (deterministic — a plain setTimeout,
//     NOT `requestIdleCallback`, so it never starves behind user activity), or
//   - the placeholder scrolling near the viewport (IntersectionObserver).
//
// Returns a `ref` to put on a lightweight placeholder + a `ready` flag to gate
// the heavy subtree (e.g. a lazy import). Mirrors the app's loading philosophy:
// out-of-sight content is eager-but-deferred, never gated purely on the
// interaction (the scroll) — the timer guarantees it loads regardless.
export function useLoadOnApproach(
  delayMs = 600,
  rootMargin = '400px'
): { ref: RefObject<HTMLDivElement>; ready: boolean } {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    // Timer starts immediately at mount — not on idle.
    const timer = setTimeout(() => setReady(true), delayMs);
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setReady(true);
        },
        { rootMargin }
      );
      io.observe(el);
    }
    return () => {
      clearTimeout(timer);
      io?.disconnect();
    };
  }, [ready, delayMs, rootMargin]);
  return { ref, ready };
}
