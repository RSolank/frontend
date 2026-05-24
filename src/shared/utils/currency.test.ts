import { describe, expect, it } from 'vitest';

import { formatMoney, parseMoney } from './currency';

describe('formatMoney', () => {
  it('uses the symbol when present (no space, prefix)', () => {
    expect(formatMoney(1234.5, 'USD', '$')).toBe('$1,234.50');
    expect(formatMoney(0, 'EUR', '€')).toBe('€0.00');
  });

  it('falls back to code + space when symbol is null', () => {
    expect(formatMoney(1234.5, 'XAF', null)).toBe('XAF 1,234.50');
    expect(formatMoney(50, 'JPY', undefined)).toBe('JPY 50.00');
  });

  it('accepts numeric strings (defensive against legacy callers)', () => {
    expect(formatMoney('1234.5', 'USD', '$')).toBe('$1,234.50');
  });

  it('treats null / undefined / non-finite as 0', () => {
    expect(formatMoney(null, 'USD', '$')).toBe('$0.00');
    expect(formatMoney(undefined, 'USD', '$')).toBe('$0.00');
    expect(formatMoney(NaN, 'USD', '$')).toBe('$0.00');
    expect(formatMoney(Infinity, 'USD', '$')).toBe('$0.00');
  });
});

describe('parseMoney', () => {
  it('strips symbols, codes, and thousands separators', () => {
    expect(parseMoney('$1,234.56')).toBe(1234.56);
    expect(parseMoney('XAF 1,234.56')).toBe(1234.56);
    expect(parseMoney('-12.5')).toBe(-12.5);
  });

  it('returns NaN for empty / null input', () => {
    expect(parseMoney(null)).toBeNaN();
    expect(parseMoney('')).toBeNaN();
    expect(parseMoney('—')).toBeNaN();
  });
});
