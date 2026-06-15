import { describe, expect, it } from 'vitest';

import { computeBudgetSignal, spendPercent } from './budgetSignal';

const base = {
  current_net_expense: 0,
  avg_net_expense: null,
  max_net_expense: null,
  limit_amt: null,
};

describe('computeBudgetSignal — limit set', () => {
  it('classifies budget bands by % of limit', () => {
    const L = { ...base, limit_amt: 100 };
    expect(computeBudgetSignal({ ...L, current_net_expense: 50 }).label).toBe(
      'On track'
    );
    expect(computeBudgetSignal({ ...L, current_net_expense: 70 }).tone).toBe(
      'watch'
    );
    expect(computeBudgetSignal({ ...L, current_net_expense: 90 }).tone).toBe(
      'near'
    );
    expect(computeBudgetSignal({ ...L, current_net_expense: 130 }).label).toBe(
      'Over budget'
    );
  });
});

describe('computeBudgetSignal — no limit (rolling baseline)', () => {
  it('falls back to the typical-range comparison', () => {
    const A = { ...base, avg_net_expense: 100, max_net_expense: 200 };
    expect(computeBudgetSignal({ ...A, current_net_expense: 50 }).label).toBe(
      'Below typical'
    );
    expect(computeBudgetSignal({ ...A, current_net_expense: 100 }).label).toBe(
      'Typical'
    );
    expect(computeBudgetSignal({ ...A, current_net_expense: 160 }).label).toBe(
      'Above typical'
    );
    expect(computeBudgetSignal({ ...A, current_net_expense: 250 }).label).toBe(
      'Most expensive yet'
    );
  });

  it('is neutral with no spend or no history', () => {
    expect(computeBudgetSignal(base).tone).toBe('neutral');
    expect(
      computeBudgetSignal({ ...base, current_net_expense: 50 }).label
    ).toBe('No budget set');
  });
});

describe('spendPercent', () => {
  it('is 0 without a positive limit', () => {
    expect(spendPercent(50, null)).toBe(0);
    expect(spendPercent(50, 0)).toBe(0);
    expect(spendPercent(50, 100)).toBe(50);
  });
});
