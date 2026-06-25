import { createContext, useContext } from 'react';

import { useReducedMotionPref } from './useReducedMotionPref';

// Entrance-orchestration channel for in-card data animation (count-ups,
// chart draw-ins, progress fills — the second beat). A <StaggerItem>
// publishes a boolean: false while it's still rising, true once it has
// landed (+ the beat pause). `null` (the default) means NO <Stagger> is
// orchestrating — the page hasn't adopted motion, so marks render static.
//
// Framer-free on purpose: `useCountUp` consumes this, and must not pull
// framer back into the bundle.
export const StaggerSettledContext = createContext<boolean | null>(null);

// The three states a data-viz mark can be in:
//   'static' — render final, NO animation. Reduced motion, OR no <Stagger>
//              orchestrating (the page hasn't adopted motion — a later
//              rollout wraps it in <Stagger> and it animates then, no rework).
//   'hold'   — inside a <Stagger>, card not yet settled → hold at baseline.
//   'go'     — inside a <Stagger>, card settled → animate (the second beat).
export type EntrancePhase = 'static' | 'hold' | 'go';

export function useEntrancePhase(): EntrancePhase {
  const reduced = useReducedMotionPref();
  const orchestrated = useContext(StaggerSettledContext);
  if (reduced || orchestrated === null) return 'static';
  return orchestrated ? 'go' : 'hold';
}
