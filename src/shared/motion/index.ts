// The shared motion foundation — app-wide animation primitives. First
// consumer is the dashboard redesign; later pages reuse the same surface.
// Always import motion components as `m.*` (not `motion.*`): the
// MotionProvider runs `LazyMotion` in `strict` mode, so `motion.*` throws.
export { MotionProvider } from './MotionProvider';
export { useCountUp, type CountUpOptions } from './useCountUp';
