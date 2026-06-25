import { type HTMLMotionProps, m } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { StaggerSettledContext } from './staggerContext';
import { useReducedMotionPref } from './useReducedMotionPref';
import { MOTION_TOKENS, fadeRise, staggerContainer } from './variants';

// Declarative entrance wrappers — the 2-line way to add motion to a page.
// A surface writes:
//
//   <Stagger className="flex flex-col gap-6">
//     <StaggerItem><ZoneA /></StaggerItem>
//     <StaggerItem><ZoneB /></StaggerItem>
//   </Stagger>
//
// and the children fade/rise in sequence on mount. Both forward every
// `m.div` prop (className, style, data-*, layout, …) so they drop into
// existing markup without a wrapper div fight. For anything outside this
// pattern (SVG draw-in, a one-off scale) reach for the raw variants in
// `./variants`.
//
// TWO-BEAT: each <StaggerItem> publishes a "settled" signal a brief beat
// after its entrance actually lands (framer's `onAnimationComplete` +
// `MOTION_TOKENS.beatPause`). In-card data animation (`useCountUp`, chart
// draw-in) keys off that signal, so the card rises, holds, then its data
// animates as a distinct, catchable second beat. Keying off the real
// completion (not a fixed delay) means it stays correct if the entrance
// timing ever changes. Reduced motion settles instantly (no pause).

// `<Stagger>` drives the container; its `staggerContainer` propagates the
// `hidden`/`show` labels down to each `<StaggerItem>`.
export function Stagger({ children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </m.div>
  );
}

// A single staggered child (fade + rise). Must sit inside a `<Stagger>` —
// it inherits the parent's `hidden`/`show` orchestration, so it sets only
// its own variant, never `initial`/`animate`. Publishes its entrance-
// complete (+ the two-beat pause) to descendants via StaggerSettledContext.
export function StaggerItem({ children, ...rest }: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotionPref();
  // Reduced motion: settled immediately (no entrance to wait on, no pause)
  // so in-card data is final on first paint.
  const [settled, setSettled] = useState(reduced);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <StaggerSettledContext.Provider value={settled}>
      <m.div
        variants={fadeRise}
        onAnimationComplete={() => {
          // Under reduced motion `settled` already starts true — no entrance
          // to wait on, no pause timer (which would otherwise linger).
          if (reduced) return;
          timer.current = setTimeout(
            () => setSettled(true),
            MOTION_TOKENS.beatPause * 1000
          );
        }}
        {...rest}
      >
        {children}
      </m.div>
    </StaggerSettledContext.Provider>
  );
}
