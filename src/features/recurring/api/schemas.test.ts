import { describe, expect, test } from 'vitest';

import {
  emptyRecurringForm,
  formToCreatePayload,
  templateToForm,
  type RecurringTemplate,
} from './schemas';

const baseTemplate: RecurringTemplate = {
  uid: 5,
  beneficiary_id: 9,
  debit_credit: 'debit',
  pattern_type: 'FIXED_AMOUNT',
  expected_amount: 1200,
  amount_tolerance: 0.1,
  cadence: 'MONTHLY',
  cadence_interval: 1,
  day_of_month: 15,
  day_of_week: null,
  week_of_month: null,
  anchor_date: '2026-06-15',
  next_due_date: '2026-07-15',
  status: 'locked',
  active: true,
  occurrence_count: 4,
  last_seen_date: '2026-05-15',
  last_confirmed_date: '2026-05-15',
  created_at: '2026-01-15T00:00:00Z',
};

describe('schemas — templateToForm', () => {
  test('round-trips an existing template through the form representation', () => {
    const form = templateToForm(baseTemplate);
    expect(form.beneficiary_id).toBe(9);
    expect(form.cadence).toBe('MONTHLY');
    expect(form.expected_amount).toBe('1200');
    expect(form.day_of_month).toBe('15');
    expect(form.day_of_week).toBe('');
  });
});

describe('schemas — formToCreatePayload', () => {
  test('returns null when beneficiary missing', () => {
    const form = emptyRecurringForm('2026-06-01');
    form.expected_amount = '100';
    expect(formToCreatePayload(form)).toBeNull();
  });

  test('returns null when amount non-positive', () => {
    const form = emptyRecurringForm('2026-06-01');
    form.beneficiary_id = 1;
    form.expected_amount = '0';
    expect(formToCreatePayload(form)).toBeNull();
  });

  test('drops day_of_week when cadence is monthly (keeps day_of_month)', () => {
    const form = emptyRecurringForm('2026-06-01');
    form.beneficiary_id = 1;
    form.expected_amount = '500';
    form.cadence = 'MONTHLY';
    form.day_of_month = '15';
    form.day_of_week = '3';
    const payload = formToCreatePayload(form);
    expect(payload?.day_of_month).toBe(15);
    expect(payload?.day_of_week).toBeUndefined();
  });

  test('drops day_of_month when cadence is weekly (keeps day_of_week)', () => {
    const form = emptyRecurringForm('2026-06-01');
    form.beneficiary_id = 1;
    form.expected_amount = '50';
    form.cadence = 'WEEKLY';
    form.day_of_week = '4';
    form.day_of_month = '20';
    const payload = formToCreatePayload(form);
    expect(payload?.day_of_week).toBe(4);
    expect(payload?.day_of_month).toBeUndefined();
  });

  test('omits cadence_interval / amount_tolerance when invalid', () => {
    const form = emptyRecurringForm('2026-06-01');
    form.beneficiary_id = 1;
    form.expected_amount = '50';
    form.cadence_interval = '';
    form.amount_tolerance = '5';
    const payload = formToCreatePayload(form);
    expect(payload?.cadence_interval).toBeUndefined();
    expect(payload?.amount_tolerance).toBeUndefined();
  });
});
