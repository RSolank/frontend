import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useMotionStore } from '../state/motion.store';

import { useCountUp } from './useCountUp';

describe('useCountUp', () => {
  afterEach(() => {
    useMotionStore.setState({ reducedMotion: false });
  });

  it('snaps straight to the target when reduced motion is on', () => {
    useMotionStore.setState({ reducedMotion: true });
    const { result } = renderHook(() => useCountUp(1240));
    // No tween — correct value on the very first render.
    expect(result.current).toBe(1240);
  });

  it('snaps to a changed target under reduced motion (no animation)', () => {
    useMotionStore.setState({ reducedMotion: true });
    const { result, rerender } = renderHook(({ t }) => useCountUp(t), {
      initialProps: { t: 100 },
    });
    expect(result.current).toBe(100);
    rerender({ t: 500 });
    expect(result.current).toBe(500);
  });

  it('animates up to the target when motion is enabled', async () => {
    useMotionStore.setState({ reducedMotion: false });
    const { result } = renderHook(() => useCountUp(1000, { durationMs: 80 }));
    // Tween settles on the exact target.
    await waitFor(() => expect(result.current).toBe(1000));
  });

  it('does not overshoot the target while animating', async () => {
    useMotionStore.setState({ reducedMotion: false });
    const { result } = renderHook(() => useCountUp(200, { durationMs: 80 }));
    // easeOut from 0 → 200 never exceeds 200.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(result.current).toBeLessThanOrEqual(200);
    await waitFor(() => expect(result.current).toBe(200));
  });
});
