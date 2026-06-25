import { useEffect, useState } from 'react';

import { useMotionStore } from '../state/motion.store';

// The app's reduced-motion contract as a single boolean: the in-app
// `useMotionStore` toggle OR the OS `prefers-reduced-motion`. Framer-free on
// purpose — `useCountUp` consumes it and must not pull framer into the
// bundle; `StaggerItem` consumes it to settle instantly (no pause) under
// reduced motion. Mirrors the MotionProvider's `MotionConfig reducedMotion`
// bridge for code that animates outside framer's `m.*`.
//
// SSR/test-safe: defaults to "no preference" when matchMedia is absent.
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotionPref(): boolean {
  const appReduced = useMotionStore((s) => s.reducedMotion);
  const [osReduced, setOsReduced] = useState(
    () => globalThis.matchMedia?.(REDUCED_QUERY).matches ?? false
  );
  useEffect(() => {
    const mql = globalThis.matchMedia?.(REDUCED_QUERY);
    if (!mql) return;
    const onChange = () => setOsReduced(mql.matches);
    setOsReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return appReduced || osReduced;
}
