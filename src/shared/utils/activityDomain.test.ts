import { describe, expect, it } from 'vitest';

import type { ActivityFeedItem } from '../api/activityFeed';

import { domainLabel, groupByDomain } from './activityDomain';

function item(
  uid: number,
  domain: string,
  summary = `item-${uid}`
): ActivityFeedItem {
  return {
    uid,
    kind: 'k',
    event_class: 'alert',
    domain,
    subject_type: 's',
    subject_id: String(uid),
    priority: 1,
    state: 'active',
    summary,
    created_at: '2026-06-01T10:00:00Z',
    refreshed_at: '2026-06-01T10:00:00Z',
    aggregate_count: 1,
  };
}

describe('domainLabel', () => {
  it('maps known domains to curated labels', () => {
    expect(domainLabel('taxation')).toBe('Taxation');
    expect(domainLabel('bank_accounts')).toBe('Bank Accounts');
    expect(domainLabel('recurring')).toBe('Recurring');
  });

  it('title-cases an unknown snake_case domain as a fallback', () => {
    expect(domainLabel('future_thing')).toBe('Future Thing');
  });

  it('falls back to "Other" for an empty domain', () => {
    expect(domainLabel('')).toBe('Other');
  });
});

describe('groupByDomain (Strategy A)', () => {
  it('orders domain groups by each domain\'s highest-ranked (first-seen) item', () => {
    // BE rank order: taxation(0), recurring(1), taxation(2), budgets(3).
    const groups = groupByDomain([
      item(0, 'taxation'),
      item(1, 'recurring'),
      item(2, 'taxation'),
      item(3, 'budgets'),
    ]);
    // taxation leads (its top item is rank 0), then recurring (rank 1),
    // then budgets (rank 3) — NOT alphabetical, NOT re-sorted.
    expect(groups.map((g) => g.domain)).toEqual([
      'taxation',
      'recurring',
      'budgets',
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      'Taxation',
      'Recurring',
      'Budgets',
    ]);
  });

  it('preserves the original BE order of items within a domain group', () => {
    const groups = groupByDomain([
      item(0, 'taxation', 'first'),
      item(5, 'recurring'),
      item(2, 'taxation', 'second'),
    ]);
    const taxation = groups.find((g) => g.domain === 'taxation');
    expect(taxation?.items.map((i) => i.summary)).toEqual(['first', 'second']);
  });

  it('emits no group for an empty list', () => {
    expect(groupByDomain([])).toEqual([]);
  });
});
