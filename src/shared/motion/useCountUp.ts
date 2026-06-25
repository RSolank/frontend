import { useEffect, useRef, useState } from 'react';

import { useEntrancePhase } from './staggerContext';

export interface CountUpOptions {
  // Tween length in ms. Kept short (a hero number, not a slot machine).
  durationMs?: number;
  // The value the first mount animates *from* (default 0 → target).
  startFrom?: number;
}

// Cubic ease-out: fast start, gentle settle. Monotonic on [0,1] → never
// overshoots the target. Matches the feel of framer's `easeOut` closely
// enough for a counter, without pulling framer into the bundle.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Animates a number from a baseline up to `target`, returning the live
// in-between value to render. Used by the dashboard hero counters — and,
// because it's framer-free, safe to drop into the landing hero (a count-up
// in the user's line of sight that must animate on the first frame with no
// load tick).
//
// Reduced-motion aware: when the in-app motion toggle (`useMotionStore`)
// OR the OS `prefers-reduced-motion` asks for less motion, the hook returns
// `target` immediately — no rAF loop — so the number is correct on first
// paint. This mirrors the MotionProvider's `reducedMotion` bridge; both
// honor the same two signals.
//
// On a `target` change (e.g. a react-query refetch) the tween runs from the
// previous value to the new one, so a live data update animates smoothly
// rather than snapping.
//
// TWO-BEAT: inside a `<StaggerItem>` the tween holds until the card's
// entrance has landed (phase `'go'`), so the count reads as a deliberate
// second beat instead of riding the entrance. `'static'` — reduced motion OR
// no `<Stagger>` orchestrating (the page hasn't adopted motion) — snaps to the
// final value with no tween.
export function useCountUp(target: number, opts: CountUpOptions = {}): number {
  const { durationMs = 700, startFrom = 0 } = opts;

  const phase = useEntrancePhase();

  const [value, setValue] = useState(phase === 'static' ? target : startFrom);
  // The baseline the next tween animates *from* — the last value we
  // settled on. Seeded so the first mount runs startFrom → target.
  const fromRef = useRef(phase === 'static' ? target : startFrom);

  useEffect(() => {
    if (phase === 'static') {
      fromRef.current = target;
      setValue(target);
      return;
    }
    // Hold at the baseline until the enclosing card has finished rising.
    if (phase === 'hold') return;

    const from = fromRef.current;
    const delta = target - from;
    // The next change tweens from here.
    fromRef.current = target;
    if (delta === 0) {
      setValue(target);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      if (t >= 1) {
        setValue(target); // land exactly on the target
        return;
      }
      setValue(from + delta * easeOut(t));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, phase, durationMs]);

  return value;
}
