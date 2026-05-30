import { describe, expect, it } from 'vitest';

import {
  buildMonthGrid,
  buildWeekRow,
  bucketByDay,
  heatBucket,
  monthKeyFromIso,
  shiftIso,
  shiftMonthKey,
} from './calendar';

const TODAY = '2026-05-28'; // ignored in most tests, just a stable sentinel.

describe('buildMonthGrid', () => {
  it('returns 42 cells covering 6 ISO weeks', () => {
    const cells = buildMonthGrid('2026-05', TODAY);
    expect(cells).toHaveLength(42);
  });

  it('starts on a Monday and ends on a Sunday', () => {
    const cells = buildMonthGrid('2026-05', TODAY);
    // ISO weekday: 0 = Mon, 6 = Sun.
    expect(cells[0]!.weekday).toBe(0);
    expect(cells[41]!.weekday).toBe(6);
  });

  it('marks pad days from prev/next month as inMonth=false', () => {
    const cells = buildMonthGrid('2026-05', TODAY);
    const padBefore = cells.filter((c) => c.year === 2026 && c.month === 4);
    const padAfter = cells.filter((c) => c.year === 2026 && c.month === 6);
    // May 1 2026 is a Friday → 4 leading pad days (Mon–Thu of April).
    expect(padBefore.length).toBeGreaterThan(0);
    expect(padBefore.every((c) => !c.inMonth)).toBe(true);
    // Trailing pad fills out to 42; some month-of-May cell will also
    // exist, so padAfter > 0.
    expect(padAfter.every((c) => !c.inMonth)).toBe(true);
  });

  it('marks the today cell', () => {
    const cells = buildMonthGrid('2026-05', '2026-05-15');
    const today = cells.find((c) => c.iso === '2026-05-15');
    expect(today?.isToday).toBe(true);
    const notToday = cells.find((c) => c.iso === '2026-05-14');
    expect(notToday?.isToday).toBe(false);
  });
});

describe('buildWeekRow', () => {
  it('returns exactly 7 cells', () => {
    const cells = buildWeekRow('2026-05-15', TODAY);
    expect(cells).toHaveLength(7);
  });

  it('row starts on the Monday of the ISO week containing the anchor', () => {
    // 2026-05-15 is a Friday — Monday of that ISO week is 2026-05-11.
    const cells = buildWeekRow('2026-05-15', TODAY);
    expect(cells[0]!.iso).toBe('2026-05-11');
    expect(cells[6]!.iso).toBe('2026-05-17');
  });
});

describe('bucketByDay', () => {
  it('sums debit and credit totals per day', () => {
    const buckets = bucketByDay(
      [
        { txn_date: '2026-05-15', amount: 100, debit_credit: 'debit' },
        { txn_date: '2026-05-15', amount: 50, debit_credit: 'debit' },
        { txn_date: '2026-05-15', amount: 200, debit_credit: 'credit' },
        { txn_date: '2026-05-16', amount: 10, debit_credit: 'debit' },
      ],
      'UTC'
    );
    expect(buckets.get('2026-05-15')).toEqual({
      iso: '2026-05-15',
      debit_total: 150,
      credit_total: 200,
      debit_count: 2,
      credit_count: 1,
    });
    expect(buckets.get('2026-05-16')?.debit_total).toBe(10);
  });

  it('treats abs(amount) so negative inputs do not subtract', () => {
    const buckets = bucketByDay(
      [{ txn_date: '2026-05-15', amount: -42, debit_credit: 'debit' }],
      'UTC'
    );
    expect(buckets.get('2026-05-15')?.debit_total).toBe(42);
  });
});

describe('heatBucket', () => {
  it('returns 0 for zero / negative input', () => {
    expect(heatBucket(0, 100)).toBe(0);
    expect(heatBucket(-1, 100)).toBe(0);
  });

  it('returns 4 at the max', () => {
    expect(heatBucket(100, 100)).toBe(4);
  });

  it('returns 1 for low-but-nonzero', () => {
    expect(heatBucket(5, 100)).toBe(1);
  });

  it('returns 2/3 in middle bands', () => {
    expect(heatBucket(30, 100)).toBe(2);
    expect(heatBucket(50, 100)).toBe(3);
  });
});

describe('shiftMonthKey', () => {
  it('handles year rollover', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
  });
});

describe('shiftIso', () => {
  it('handles month rollover', () => {
    expect(shiftIso('2026-05-31', 1)).toBe('2026-06-01');
    expect(shiftIso('2026-05-01', -1)).toBe('2026-04-30');
  });
});

describe('monthKeyFromIso', () => {
  it('extracts the YYYY-MM prefix', () => {
    expect(monthKeyFromIso('2026-05-28')).toBe('2026-05');
  });
});
