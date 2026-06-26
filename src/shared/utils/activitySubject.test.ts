import { describe, expect, it } from 'vitest';

import type { ActivityFeedItem } from '../api/activityFeed';

import { subjectMeta } from './activitySubject';

function item(overrides: Partial<ActivityFeedItem>): ActivityFeedItem {
  return {
    uid: 1,
    kind: 'k',
    event_class: 'alert',
    domain: 'recurring',
    subject_type: 'recurring',
    subject_id: 'bill:42',
    priority: 1,
    state: 'active',
    summary: 's',
    created_at: '2026-06-01T10:00:00Z',
    refreshed_at: '2026-06-01T10:00:00Z',
    aggregate_count: 1,
    ...overrides,
  };
}

describe('subjectMeta — recurring signals point at their row', () => {
  it('pattern_detected → templates deep-link (parses tmpl: slot key)', () => {
    const meta = subjectMeta(
      item({ kind: 'recurring_pattern_detected', subject_id: 'tmpl:7' })
    );
    expect(meta.href).toBe('/settings/recurring?template=7');
    expect(meta.ctaLabel).toBe('View template');
  });

  it('bill_upcoming → Upcoming tab + bill highlight (parses bill: slot key)', () => {
    const meta = subjectMeta(
      item({ kind: 'recurring_bill_upcoming', subject_id: 'bill:42' })
    );
    expect(meta.href).toBe('/settings/recurring?tab=upcoming&bill=42');
    expect(meta.ctaLabel).toBe('View upcoming bill');
  });

  it('bill_pending → same Upcoming-tab bill target, urgent label', () => {
    const meta = subjectMeta(
      item({ kind: 'recurring_bill_pending', subject_id: 'bill:9' })
    );
    expect(meta.href).toBe('/settings/recurring?tab=upcoming&bill=9');
    expect(meta.ctaLabel).toBe('Review bill due');
  });

  it('an unknown recurring-domain kind lands on the page itself', () => {
    const meta = subjectMeta(
      item({ kind: 'recurring_something_new', subject_id: 'bill:1' })
    );
    expect(meta.href).toBe('/settings/recurring');
  });

  it('tolerates a slot id without a prefix', () => {
    const meta = subjectMeta(
      item({ kind: 'recurring_pattern_detected', subject_id: '7' })
    );
    expect(meta.href).toBe('/settings/recurring?template=7');
  });
});
