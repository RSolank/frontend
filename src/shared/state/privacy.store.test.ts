import { afterEach, describe, expect, it } from 'vitest';

import { applyPrivacyMask, usePrivacyStore } from './privacy.store';

describe('privacy.store', () => {
  afterEach(() => {
    usePrivacyStore.setState({ mask: false });
    document.documentElement.classList.remove('mask-amounts');
  });

  it('toggle flips the flag', () => {
    expect(usePrivacyStore.getState().mask).toBe(false);
    usePrivacyStore.getState().toggle();
    expect(usePrivacyStore.getState().mask).toBe(true);
  });

  it('applyPrivacyMask toggles the html class', () => {
    applyPrivacyMask(true);
    expect(document.documentElement.classList.contains('mask-amounts')).toBe(
      true
    );
    applyPrivacyMask(false);
    expect(document.documentElement.classList.contains('mask-amounts')).toBe(
      false
    );
  });
});
