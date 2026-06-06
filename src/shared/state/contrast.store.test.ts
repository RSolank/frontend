import { afterEach, describe, expect, it } from 'vitest';

import { applyContrast, useContrastStore } from './contrast.store';

describe('contrast.store', () => {
  afterEach(() => {
    useContrastStore.setState({ high: false });
    document.documentElement.classList.remove('high-contrast');
  });

  it('toggle flips the flag', () => {
    expect(useContrastStore.getState().high).toBe(false);
    useContrastStore.getState().toggle();
    expect(useContrastStore.getState().high).toBe(true);
  });

  it('applyContrast toggles the html class', () => {
    applyContrast(true);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(
      true
    );
    applyContrast(false);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(
      false
    );
  });
});
