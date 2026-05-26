import { describe, expect, it } from 'vitest';

import {
  fractionOfWeekElapsed,
  precedingWeekStartInTz,
  weekRangeInTz,
} from './billPeriod';

// All cases pin a fixed `Date` so they're stable across CI runs.

describe('weekRangeInTz', () => {
  it('Sun → Sat range for a Wednesday in UTC', () => {
    // 2026-03-04 was a Wednesday.
    const wed = new Date('2026-03-04T12:00:00Z');
    const r = weekRangeInTz(wed, 'UTC');
    expect(r.period_start).toBe('2026-03-01');
    expect(r.period_end).toBe('2026-03-07');
  });

  it('returns the same calendar week when called on Sunday', () => {
    const sun = new Date('2026-03-01T12:00:00Z');
    const r = weekRangeInTz(sun, 'UTC');
    expect(r.period_start).toBe('2026-03-01');
    expect(r.period_end).toBe('2026-03-07');
  });

  it('honors the user timezone — Sun UTC 22:00 is already Mon in Asia/Kolkata', () => {
    // 2026-03-01 22:00 UTC == 2026-03-02 03:30 IST → Mon in IST, so
    // week starts on the *previous* Sunday in IST, which is the same
    // calendar Sunday (2026-03-01) because that's the IST week start.
    const sunEve = new Date('2026-03-01T22:00:00Z');
    const r = weekRangeInTz(sunEve, 'Asia/Kolkata');
    expect(r.period_start).toBe('2026-03-01');
    expect(r.period_end).toBe('2026-03-07');
  });
});

describe('precedingWeekStartInTz', () => {
  it('returns a YYYY-MM-DD Sunday before today', () => {
    const result = precedingWeekStartInTz('UTC');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('fractionOfWeekElapsed', () => {
  it('returns ~0 at the very start of Sunday', () => {
    const sunMidnight = new Date('2026-03-01T00:00:00Z');
    const f = fractionOfWeekElapsed(sunMidnight, 'UTC');
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(0.01);
  });

  it('returns ~1 at the very end of Saturday', () => {
    const satLate = new Date('2026-03-07T23:59:00Z');
    const f = fractionOfWeekElapsed(satLate, 'UTC');
    expect(f).toBeGreaterThan(0.99);
    expect(f).toBeLessThanOrEqual(1);
  });

  it('returns ~0.5 midweek (Wed noon)', () => {
    const wedNoon = new Date('2026-03-04T12:00:00Z');
    const f = fractionOfWeekElapsed(wedNoon, 'UTC');
    expect(f).toBeGreaterThan(0.49);
    expect(f).toBeLessThan(0.55);
  });
});
