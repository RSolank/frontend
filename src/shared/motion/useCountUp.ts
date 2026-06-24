import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { useMotionStore } from '../state/motion.store';

export interface CountUpOptions {
  // Tween length in ms. Kept short (a hero number, not a slot machine).
  durationMs?: number;
  // The value the first mount animates *from* (default 0 → target).
  startFrom?: number;
}

// Animates a number from a baseline up to `target`, returning the live
// in-between value to render. Used by the dashboard hero counters.
//
// Reduced-motion aware: when the in-app motion toggle
// (`useMotionStore`) OR the OS `prefers-reduced-motion` asks for less
// motion, the hook returns `target` immediately — no tween, no frame loop
// — so the number is correct on first paint. This mirrors the
// MotionProvider's `reducedMotion` bridge; both honor the same two signals.
//
// On a `target` change (e.g. a react-query refetch) the tween runs from the
// previous value to the new one, so a live data update animates smoothly
// rather than snapping.
export function useCountUp(target: number, opts: CountUpOptions = {}): number {
  const { durationMs = 700, startFrom = 0 } = opts;

  const appReduced = useMotionStore((s) => s.reducedMotion);
  const osReduced = useReducedMotion();
  const reduced = appReduced || Boolean(osReduced);

  const [value, setValue] = useState(reduced ? target : startFrom);
  // The baseline the next tween animates *from* — the last value we
  // settled on. Seeded so the first mount runs startFrom → target.
  const fromRef = useRef(reduced ? target : startFrom);

  useEffect(() => {
    if (reduced) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const controls = animate(fromRef.current, target, {
      duration: durationMs / 1000,
      ease: 'easeOut',
      onUpdate: (v) => setValue(v),
    });
    // The next change tweens from here.
    fromRef.current = target;
    return () => controls.stop();
  }, [target, reduced, durationMs]);

  return value;
}
