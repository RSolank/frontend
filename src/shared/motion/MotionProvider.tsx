import {
  type FeatureBundle,
  LazyMotion,
  type LazyFeatureBundle,
  MotionConfig,
} from 'framer-motion';
import type { ReactNode } from 'react';

import { useMotionStore } from '../state/motion.store';

// App-wide motion foundation (first consumer: the dashboard redesign;
// later, every page). Two jobs:
//
//   1. `LazyMotion` with `strict` — code-splits the animation feature
//      bundle (see `domFeatures.ts`) AND forbids the heavyweight
//      `motion.*` components, forcing every consumer onto the lightweight
//      `m.*` shell. This is what keeps motion off the critical path:
//      content paints first, the feature chunk streams in after.
//
//   2. `MotionConfig reducedMotion` — the single bridge between our
//      accessibility controls and framer-motion. `useMotionStore` is the
//      in-app override (the MotionToggle in settings); when it's on we
//      force `'always'`, otherwise we defer to `'user'` so framer follows
//      the OS `prefers-reduced-motion`. Either signal collapses transform
//      / layout animations to nothing while leaving content fully visible
//      — the same contract the CSS `.reduce-motion` class already enforces
//      for non-JS transitions, now extended to JS-driven animation.
//
// Mounted once at the app root (see `app/providers.tsx`). Cheap to wrap the
// whole tree: with no `m` component mounted, the lazy feature chunk is
// never even requested.
const loadFeatures = () =>
  import('./domFeatures').then((mod) => mod.default);

// `features` is overridable, and both the app root and tests pass an EAGER
// bundle: production injects `domAnimation` at `app/providers.tsx` so the
// above-the-fold landing hero animates with framer on first paint (a lazy
// chunk would leave the hero invisible until it streamed in); tests inject
// synchronously (a dynamic import resolving after a test unmounts is a
// cross-test flake source). The `loadFeatures` lazy default below is kept as
// a fallback for any standalone mount that can tolerate deferred animation.
export function MotionProvider({
  children,
  features = loadFeatures,
}: {
  children: ReactNode;
  features?: FeatureBundle | LazyFeatureBundle;
}) {
  const appReduced = useMotionStore((s) => s.reducedMotion);

  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion={appReduced ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
