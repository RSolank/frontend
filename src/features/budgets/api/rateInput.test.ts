import { describe, expect, it } from 'vitest';

import { formatRateForInput, parseRateInput } from './rateInput';

describe('formatRateForInput', () => {
  it('renders a fraction as a humanized percentage', () => {
    expect(formatRateForInput(0)).toBe('0%');
    expect(formatRateForInput(0.05)).toBe('5%');
    expect(formatRateForInput(0.125)).toBe('12.5%');
    expect(formatRateForInput(0.5)).toBe('50%');
    expect(formatRateForInput(1)).toBe('100%');
  });
});

describe('parseRateInput', () => {
  it('parses `%`-suffixed numbers as percentages', () => {
    expect(parseRateInput('5%')).toBeCloseTo(0.05);
    expect(parseRateInput('12.5%')).toBeCloseTo(0.125);
    expect(parseRateInput(' 50% ')).toBeCloseTo(0.5);
  });

  it('treats bare values ≥ 1 as percentages (lenient mode)', () => {
    expect(parseRateInput('5')).toBeCloseTo(0.05);
    expect(parseRateInput('50')).toBeCloseTo(0.5);
  });

  it('treats bare values < 1 as raw fractions', () => {
    expect(parseRateInput('0.05')).toBeCloseTo(0.05);
    expect(parseRateInput('0.5')).toBeCloseTo(0.5);
  });

  it('returns null for empty / invalid input', () => {
    expect(parseRateInput('')).toBeNull();
    expect(parseRateInput('   ')).toBeNull();
    expect(parseRateInput('abc')).toBeNull();
  });
});
