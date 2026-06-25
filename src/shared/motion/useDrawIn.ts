import { useEntrancePhase } from './staggerContext';

// Entrance control for a draw-in mark (chart bar / line / donut arc / any
// `m.*` with a `hidden`/`show` variant). Returns `initial` + `animate` so the
// mark:
//   - draws `hidden → show` once the enclosing <StaggerItem> has settled
//     (phase `'go'` — the two-beat, after the card lands + pause),
//   - waits hidden while the card is still rising (`'hold'`),
//   - renders its final state with NO animation (`'static'`) — reduced motion,
//     OR no <Stagger> orchestrating (the page hasn't adopted motion yet).
export function useDrawIn(): {
  initial: false | 'hidden';
  animate: 'hidden' | 'show';
  // false on a page that hasn't adopted motion (or reduced motion) — render
  // the mark as PLAIN SVG then, so framer never touches it (no first-paint
  // flash, and no stray entrance when lazy features arrive late on a cold load).
  animated: boolean;
} {
  const phase = useEntrancePhase();
  return {
    initial: phase === 'static' ? false : 'hidden',
    animate: phase === 'hold' ? 'hidden' : 'show',
    animated: phase !== 'static',
  };
}
