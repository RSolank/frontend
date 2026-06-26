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
  // Modal panel grow/shrink durations (T-nav-ia-reorg #6). ASYMMETRIC by
  // design: the open is quicker than the close because the open has a SECOND
  // beat (the field fade→rise) after the panel lands, while the close is
  // panel-only. Consumed by <Modal> for the panel and by the in-modal field
  // reveal below (the fade delay derives from `modalPanelOpen`), so retuning
  // one number keeps the whole open choreography aligned.
  modalPanelOpen: 0.24,
  modalPanelClose: 0.3,
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

// --- In-modal field reveal (T-nav-ia-reorg #6, app-wide THREE-beat) ----------
// The modal open is three decoupled beats, so content that loads at different
// speeds (a warm bell section vs a cold form fetch) always reads smooth — the
// same vocabulary for every modal. Drive it with `<ModalReveal>` / `<RevealField>`.
//   1. PANEL LAND — the <Modal> panel scales up from its origin over
//      `modalPanelOpen`, opacity constant. Ungated; never waits on data.
//   2. FADE — each field starts VISIBLE (`shell`, opacity 1) so the growing
//      panel looks content-rich (symmetric with the content-rich close), then
//      fades to 0 (`hidden`). The fade is DELAYED to ~half the panel-open so it
//      completes AS the panel settles — not at t=0, which would empty the shell
//      while it's still small/growing. It bridges the 1→0 drop smoothly (no
//      snap) and fills the gap until data is ready.
//   3. RISE — once the panel has settled AND the surface's data is ready
//      (`useStabilizedEntrance`), fields rise 0→1 + 8px lift, staggered. The
//      rise interrupts the in-flight fade, so it resumes from the CURRENT
//      opacity (framer's interrupt handling = the dynamic floor: warm data →
//      shallow dip, slow/cold data → full dip then rise). A modal that doesn't
//      adopt the wrappers renders its fields static (the default no-motion path).
// Small so the field GROUPS rise almost together — a faint lead-in, not a
// per-field cascade. With the long rise below, the last group starts well
// before the first finishes, so the entrance reads as one wave (the per-field
// independence is reserved for MUTATIONS — e.g. the assigned-tag chips).
const FORM_FIELD_STAGGER = 0.02;
// The rise is deliberately LONGER than the stagger spread so the groups overlap
// into one continuous wave rather than popping up individually.
const FORM_RISE_DUR = 0.3;
// Fade starts at HALF the panel-open and runs 0.12, so it completes exactly as
// the panel lands (0.12 + 0.12 = modalPanelOpen): at land opacity is already 0
// and the rise begins — no land-with-fields-visible-then-fade (the
// show-hide-show). The delay tracks the panel-open token (half), so retuning the
// panel keeps the fade anchored to the grow.
const FORM_FADE_DUR = 0.12;
const FORM_FADE_DELAY = MOTION_TOKENS.modalPanelOpen / 2;

export const formStaggerContainer: Variants = {
  // `shell` and `hidden` carry no child orchestration; only the rise staggers
  // (the fade fires synchronously across all fields).
  shell: {},
  hidden: {},
  show: { transition: { staggerChildren: FORM_FIELD_STAGGER } },
};
export const formFieldReveal: Variants = {
  shell: { opacity: 1, y: 8 },
  hidden: {
    opacity: 0,
    y: 8,
    transition: {
      duration: FORM_FADE_DUR,
      delay: FORM_FADE_DELAY,
      ease: MOTION_TOKENS.ease,
    },
  },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: FORM_RISE_DUR, ease: MOTION_TOKENS.ease },
  },
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
