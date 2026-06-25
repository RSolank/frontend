import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useMotionStore } from '../state/motion.store';

import { StaggerSettledContext } from './staggerContext';
import { useCountUp } from './useCountUp';

// Simulates being inside a settled <StaggerItem> (entrance landed) — the only
// context in which a count-up animates. Outside a <Stagger> a mark is static.
const InSettledStagger = ({ children }: { children: ReactNode }) => (
  <StaggerSettledContext.Provider value={true}>
    {children}
  </StaggerSettledContext.Provider>
);

describe('useCountUp', () => {
  afterEach(() => {
    useMotionStore.setState({ reducedMotion: false });
  });

  it('snaps straight to the target when reduced motion is on', () => {
    useMotionStore.setState({ reducedMotion: true });
    const { result } = renderHook(() => useCountUp(1240), {
      wrapper: InSettledStagger,
    });
    // No tween — correct value on the very first render.
    expect(result.current).toBe(1240);
  });

  it('snaps to the target outside a <Stagger> (page has no motion)', () => {
    useMotionStore.setState({ reducedMotion: false });
    // No orchestrator → phase 'static' → final value, no tween.
    const { result } = renderHook(() => useCountUp(777));
    expect(result.current).toBe(777);
  });

  it('snaps to a changed target under reduced motion (no animation)', () => {
    useMotionStore.setState({ reducedMotion: true });
    const { result, rerender } = renderHook(({ t }) => useCountUp(t), {
      initialProps: { t: 100 },
      wrapper: InSettledStagger,
    });
    expect(result.current).toBe(100);
    rerender({ t: 500 });
    expect(result.current).toBe(500);
  });

  it('animates up to the target inside a settled stagger', async () => {
    useMotionStore.setState({ reducedMotion: false });
    const { result } = renderHook(() => useCountUp(1000, { durationMs: 80 }), {
      wrapper: InSettledStagger,
    });
    // Tween settles on the exact target.
    await waitFor(() => expect(result.current).toBe(1000));
  });

  it('does not overshoot the target while animating', async () => {
    useMotionStore.setState({ reducedMotion: false });
    const { result } = renderHook(() => useCountUp(200, { durationMs: 80 }), {
      wrapper: InSettledStagger,
    });
    // easeOut from 0 → 200 never exceeds 200.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(result.current).toBeLessThanOrEqual(200);
    await waitFor(() => expect(result.current).toBe(200));
  });
});
