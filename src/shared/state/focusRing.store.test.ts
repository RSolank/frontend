import { afterEach, describe, expect, it } from 'vitest';

import { applyFocusRing, useFocusRingStore } from './focusRing.store';

describe('focusRing.store', () => {
  afterEach(() => {
    useFocusRingStore.setState({ alwaysVisible: false });
    document.documentElement.classList.remove('focus-always');
  });

  it('toggle flips the flag', () => {
    expect(useFocusRingStore.getState().alwaysVisible).toBe(false);
    useFocusRingStore.getState().toggle();
    expect(useFocusRingStore.getState().alwaysVisible).toBe(true);
  });

  it('applyFocusRing toggles the html class', () => {
    applyFocusRing(true);
    expect(
      document.documentElement.classList.contains('focus-always')
    ).toBe(true);
    applyFocusRing(false);
    expect(
      document.documentElement.classList.contains('focus-always')
    ).toBe(false);
  });
});
