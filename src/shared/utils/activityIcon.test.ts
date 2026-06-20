import { Bell, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { iconForKind } from './activityIcon';

describe('iconForKind', () => {
  it('maps a known exact kind', () => {
    expect(iconForKind('bill_overdue')).toBe(Clock);
    expect(iconForKind('bill_paid')).toBe(CheckCircle2);
  });

  it('maps the recurring_* prefix', () => {
    expect(iconForKind('recurring_bill_pending')).toBe(RefreshCw);
    expect(iconForKind('recurring_pattern_detected')).toBe(RefreshCw);
  });

  it('falls back to Bell for an unknown kind (new BE kinds never break a consumer)', () => {
    expect(iconForKind('some_future_kind')).toBe(Bell);
  });
});
