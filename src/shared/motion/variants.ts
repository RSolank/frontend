import type { Transition, Variants } from 'framer-motion';

// Shared motion vocabulary — one tuned set of timings/easings so every
// surface (dashboard, expense tracker, tax tracker, savings, onboarding,
// the landing) feels like the same product. Pages should reach for the
// `<Stagger>/<StaggerItem>` wrappers first; these raw variants are the
// escape hatch for bespoke cases (charts draw-in on an SVG `m.path`, an
// element that animates outside a stagger group, etc.).
//
// Reduced motion is NOT handled here — the app-wide MotionProvider's
// `MotionConfig reducedMotion` collapses every transform/opacity tween to
// nothing while leaving content fully rendered. So a variant only ever
// describes the *full-motion* path; the accessibility contract is central.

// The single source for timing/easing — tweak motion globally here.
export const MOTION_TOKENS = {
  // Seconds between staggered children.
  stagger: 0.06,
  // Standard entrance duration (seconds).
  duration: 0.3,
  // Standard easing — decelerate into rest.
  ease: 'easeOut',
  // The TWO-BEAT pause: how long a card holds after its entrance lands
  // before its in-card data animates (count-ups, chart draw-ins). Keeps the
  // second beat a distinct, catchable moment rather than riding the rise.
  beatPause: 0.16,
} as const;

const entrance: Transition = {
  duration: MOTION_TOKENS.duration,
  ease: MOTION_TOKENS.ease,
};

// Container that sequences its children's entrance. Pair with `fadeRise`
// (or any variant exposing `hidden`/`show`) on each child.
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: MOTION_TOKENS.stagger } },
};

// The staggered item: a gentle fade + rise. The 90% entrance.
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: entrance },
};

// Pop-in for cards / surfaces that read better growing into place.
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: entrance },
};

// SVG stroke draw-in (chart lines / sparks): pathLength 0 → 1. Apply to an
// `m.path` / `m.line`; slightly longer so the draw reads as deliberate.
export const drawIn: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.6, ease: MOTION_TOKENS.ease },
  },
};
