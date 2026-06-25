import { type HTMLMotionProps, m, useInView } from 'framer-motion';
import { useRef } from 'react';

import { StaggerSettledContext } from './staggerContext';
import { useReducedMotionPref } from './useReducedMotionPref';
import { fadeRise } from './variants';

// Scroll-reveal: fades/rises in the first time it scrolls into view, and
// publishes the two-beat "settled" signal to its descendants — so in-section
// data (charts via useDrawIn, count-ups, progress fills) animates AS THE
// SECTION REVEALS, not on mount while it's still off-screen. For
// below-the-fold content like the landing showcases.
//
// Reduced motion (or when already in view on mount): renders final, in place.
export function Reveal({ children, ...rest }: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  // `once` so it doesn't replay on scroll-up; the bottom margin starts the
  // reveal a little before the section is fully on screen.
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const shown = reduced || inView;
  return (
    <StaggerSettledContext.Provider value={shown}>
      <m.div
        ref={ref}
        variants={fadeRise}
        initial={reduced ? false : 'hidden'}
        animate={shown ? 'show' : 'hidden'}
        {...rest}
      >
        {children}
      </m.div>
    </StaggerSettledContext.Provider>
  );
}
