import { afterEach, describe, expect, it } from 'vitest';

import { applyMotion, useMotionStore } from './motion.store';

describe('motion.store', () => {
  afterEach(() => {
    useMotionStore.setState({ reducedMotion: false });
    document.documentElement.classList.remove('reduce-motion');
  });

  it('toggle flips the flag', () => {
    expect(useMotionStore.getState().reducedMotion).toBe(false);
    useMotionStore.getState().toggle();
    expect(useMotionStore.getState().reducedMotion).toBe(true);
    useMotionStore.getState().toggle();
    expect(useMotionStore.getState().reducedMotion).toBe(false);
  });

  it('applyMotion toggles the html class', () => {
    applyMotion(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(
      true
    );
    applyMotion(false);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(
      false
    );
  });
});
