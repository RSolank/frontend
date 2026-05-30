import { describe, expect, it } from 'vitest';

import {
  fractionOfWeekElapsed,
  precedingWeekStartInTz,
  weekRangeInTz,
} from './billPeriod';

// All cases pin a fixed `Date` so they're stable across CI runs.
// Convention: ISO 8601 — Mon→Sun (project-wide lock 2026-05-28).

describe('weekRangeInTz', () => {
  it('Mon → Sun range for a Wednesday in UTC', () => {
    // 2026-03-04 was a Wednesday.
    const wed = new Date('2026-03-04T12:00:00Z');
    const r = weekRangeInTz(wed, 'UTC');
    expect(r.period_start).toBe('2026-03-02');
    expect(r.period_end).toBe('2026-03-08');
  });

  it('returns the same calendar week when called on Monday', () => {
    // 2026-03-02 was a Monday.
    const mon = new Date('2026-03-02T12:00:00Z');
    const r = weekRangeInTz(mon, 'UTC');
    expect(r.period_start).toBe('2026-03-02');
    expect(r.period_end).toBe('2026-03-08');
  });

  it('Sunday rolls back to the previous Monday', () => {
    // 2026-03-08 was a Sunday — still the week starting 2026-03-02.
    const sun = new Date('2026-03-08T12:00:00Z');
    const r = weekRangeInTz(sun, 'UTC');
    expect(r.period_start).toBe('2026-03-02');
    expect(r.period_end).toBe('2026-03-08');
  });

  it('honors the user timezone — Sun UTC 22:00 is already Mon in Asia/Kolkata', () => {
    // 2026-03-01 22:00 UTC == 2026-03-02 03:30 IST → Mon in IST, so
    // the IST week starts on that Mon (2026-03-02).
    const sunEve = new Date('2026-03-01T22:00:00Z');
    const r = weekRangeInTz(sunEve, 'Asia/Kolkata');
    expect(r.period_start).toBe('2026-03-02');
    expect(r.period_end).toBe('2026-03-08');
  });
});

describe('precedingWeekStartInTz', () => {
  it('returns a YYYY-MM-DD Monday before today', () => {
    const result = precedingWeekStartInTz('UTC');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('fractionOfWeekElapsed', () => {
  it('returns ~0 at the very start of Monday', () => {
    // 2026-03-02 was a Monday.
    const monMidnight = new Date('2026-03-02T00:00:00Z');
    const f = fractionOfWeekElapsed(monMidnight, 'UTC');
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(0.01);
  });

  it('returns ~1 at the very end of Sunday', () => {
    // 2026-03-08 was a Sunday.
    const sunLate = new Date('2026-03-08T23:59:00Z');
    const f = fractionOfWeekElapsed(sunLate, 'UTC');
    expect(f).toBeGreaterThan(0.99);
    expect(f).toBeLessThanOrEqual(1);
  });

  it('returns ~0.5 midweek (Thu noon)', () => {
    // Mid-ISO-week is Thursday rather than Wednesday.
    const thuNoon = new Date('2026-03-05T12:00:00Z');
    const f = fractionOfWeekElapsed(thuNoon, 'UTC');
    expect(f).toBeGreaterThan(0.49);
    expect(f).toBeLessThan(0.55);
  });
});
