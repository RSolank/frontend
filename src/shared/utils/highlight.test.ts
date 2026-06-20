import { describe, expect, test } from 'vitest';

import { HIGHLIGHT_PULSE, highlightClass } from './highlight';

describe('highlightClass', () => {
  test('returns empty string when not highlighted', () => {
    expect(highlightClass(false)).toBe('');
    expect(highlightClass(false, 'surface')).toBe('');
  });

  test('returns the glow-pulse class when highlighted', () => {
    expect(highlightClass(true)).toBe(HIGHLIGHT_PULSE);
  });

  test('both variants resolve to the same glow class (unified)', () => {
    expect(highlightClass(true, 'surface')).toBe(HIGHLIGHT_PULSE);
    expect(highlightClass(true, 'ring')).toBe(highlightClass(true, 'surface'));
  });

  test('the class is the index.css `highlight-pulse` keyframe target', () => {
    expect(HIGHLIGHT_PULSE).toBe('highlight-pulse');
  });
});
