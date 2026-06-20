import { describe, expect, test } from 'vitest';

import {
  HIGHLIGHT_RING,
  HIGHLIGHT_SURFACE,
  highlightClass,
} from './highlight';

describe('highlightClass', () => {
  test('returns empty string when not highlighted', () => {
    expect(highlightClass(false)).toBe('');
    expect(highlightClass(false, 'surface')).toBe('');
  });

  test('returns the ring token by default', () => {
    expect(highlightClass(true)).toBe(HIGHLIGHT_RING);
  });

  test('returns the surface token (ring + bg tint) when asked', () => {
    expect(highlightClass(true, 'surface')).toBe(HIGHLIGHT_SURFACE);
    expect(HIGHLIGHT_SURFACE.startsWith(HIGHLIGHT_RING)).toBe(true);
  });

  test('uses a theme-stable violet ring (no dark: variant)', () => {
    expect(HIGHLIGHT_RING).toContain('ring-violet-500');
    expect(HIGHLIGHT_RING).not.toContain('dark:ring');
  });
});
