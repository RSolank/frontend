// The shared motion foundation — app-wide animation primitives. Mounted
// once at the app root (see `app/providers.tsx`); every page consumes the
// same surface. Always import motion components as `m.*` (not `motion.*`):
// the MotionProvider runs `LazyMotion` in `strict` mode, so `motion.*`
// throws. To add motion to a page, see the recipe in
// `frontend/docs/conventions.md` (#motion).
export { MotionProvider } from './MotionProvider';
export { useCountUp, type CountUpOptions } from './useCountUp';
export { Stagger, StaggerItem } from './Stagger';
export { Reveal } from './Reveal';
export { ModalReveal, RevealField } from './ModalReveal';
export { MutationPresence, mutationItemProps } from './MutationReveal';
export { useDrawIn } from './useDrawIn';
export {
  MOTION_TOKENS,
  drawIn,
  fadeRise,
  scaleIn,
  staggerContainer,
} from './variants';
