import { afterEach, describe, expect, it } from 'vitest';

import {
  applyLinkUnderline,
  useLinkUnderlineStore,
} from './linkUnderline.store';

describe('linkUnderline.store', () => {
  afterEach(() => {
    useLinkUnderlineStore.setState({ underline: false });
    document.documentElement.classList.remove('underline-links');
  });

  it('toggle flips the flag', () => {
    expect(useLinkUnderlineStore.getState().underline).toBe(false);
    useLinkUnderlineStore.getState().toggle();
    expect(useLinkUnderlineStore.getState().underline).toBe(true);
  });

  it('applyLinkUnderline toggles the html class', () => {
    applyLinkUnderline(true);
    expect(
      document.documentElement.classList.contains('underline-links')
    ).toBe(true);
    applyLinkUnderline(false);
    expect(
      document.documentElement.classList.contains('underline-links')
    ).toBe(false);
  });
});
