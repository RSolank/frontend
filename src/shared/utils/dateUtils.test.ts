import { describe, expect, it, vi } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatDisplayDate,
  formatInputDate,
  localToUtcIso,
  todayInUserTz,
} from './dateUtils';

describe('formatDate (tz-aware)', () => {
  it('renders the iso instant in the user tz, not UTC', () => {
    // 2026-03-05T23:30:00Z is already 2026-03-06 in Kolkata (+05:30).
    const utc = '2026-03-05T23:30:00Z';
    expect(formatDate(utc, 'Asia/Kolkata')).toBe('Mar 6, 2026');
    expect(formatDate(utc, 'UTC')).toBe('Mar 5, 2026');
  });

  it('returns the em dash for empty input', () => {
    expect(formatDate(null, 'UTC')).toBe('—');
    expect(formatDate(undefined, 'UTC')).toBe('—');
    expect(formatDate('', 'UTC')).toBe('—');
  });

  it('returns the em dash for an unparseable string', () => {
    expect(formatDate('not-a-date', 'UTC')).toBe('—');
  });
});

describe('formatDateTime (tz-aware)', () => {
  it('renders date + time in the user tz', () => {
    const out = formatDateTime('2026-03-05T23:30:00Z', 'Asia/Kolkata');
    // Different ICU builds may render "05:00", "5:00", or "AM/PM" variants;
    // the date half is the stable bit.
    expect(out).toContain('Mar 6, 2026');
  });
});

describe('todayInUserTz', () => {
  it('returns a YYYY-MM-DD shaped string', () => {
    expect(todayInUserTz('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('crosses the date boundary for users east of UTC after their day rolls over', () => {
    // Pin clock to 2026-03-05T20:00:00Z — already 2026-03-06 in Kolkata.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T20:00:00Z'));
    expect(todayInUserTz('UTC')).toBe('2026-03-05');
    expect(todayInUserTz('Asia/Kolkata')).toBe('2026-03-06');
    vi.useRealTimers();
  });
});

describe('localToUtcIso', () => {
  it('treats the date as midnight in the user tz', () => {
    // Midnight 2026-03-05 in Kolkata is 2026-03-04T18:30:00Z.
    expect(localToUtcIso('2026-03-05', 'Asia/Kolkata')).toBe(
      '2026-03-04T18:30:00.000Z'
    );
  });

  it('round-trips UTC midnight when tz is UTC', () => {
    expect(localToUtcIso('2026-03-05', 'UTC')).toBe('2026-03-05T00:00:00.000Z');
  });

  it('throws on an invalid date string', () => {
    expect(() => localToUtcIso('not-a-date', 'UTC')).toThrow();
  });
});

describe('legacy formatters (kept for unmigrated callers)', () => {
  it('formatDisplayDate handles invalid input gracefully', () => {
    expect(formatDisplayDate(null)).toBe('—');
    expect(formatDisplayDate('bogus')).toBe('bogus');
  });

  it('formatInputDate extracts YYYY-MM-DD', () => {
    expect(formatInputDate('2026-03-05T12:34:56Z')).toBe('2026-03-05');
    expect(formatInputDate(null)).toBe('');
    expect(formatInputDate('bogus')).toBe('');
  });
});
