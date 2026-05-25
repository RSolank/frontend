import { describe, expect, it } from 'vitest';

import {
  chooseRepresentativePrimary,
  groupRules,
  tagSetKey,
} from './grouping';
import type { CategorizationRule } from './queries';
import type { FlatTag } from './ruleUtils';

const flat: FlatTag[] = [
  { tag_id: 10, tag_name: 'Food', parent: null },
  { tag_id: 12, tag_name: 'Groceries', parent: 10 },
  { tag_id: 13, tag_name: 'Dining', parent: 10 },
  { tag_id: 20, tag_name: 'Utilities', parent: null },
  { tag_id: 22, tag_name: 'Internet', parent: 20 },
];

function rule(
  uid: number,
  beneficiary: string,
  tag_ids: number[]
): CategorizationRule {
  return {
    uid,
    rule_name: `${beneficiary} -> ...`,
    beneficiary_id: uid * 10,
    beneficiary_name: beneficiary,
    beneficiary_aliases: [],
    tag_ids,
    notes: null,
    created_by: 1,
  };
}

describe('tagSetKey', () => {
  it('sorts and dedupes ids so order does not affect the key', () => {
    expect(tagSetKey([12, 15])).toBe(tagSetKey([15, 12]));
    expect(tagSetKey([12, 12, 15])).toBe(tagSetKey([15, 12]));
  });
});

describe('chooseRepresentativePrimary', () => {
  it('picks the unique most-frequent primary', () => {
    const rules = [
      rule(1, 'A', [12, 22]),
      rule(2, 'B', [12, 22]),
      rule(3, 'C', [22, 12]),
    ];
    const choice = chooseRepresentativePrimary(rules, flat);
    expect(choice).toEqual({ tagId: 12, isParentFallback: false });
  });

  it('falls back to the shared parent when tied tags share one', () => {
    // [12, 13] and [13, 12] tie at primary count 1 each. 12 and 13
    // both share parent 10 (Food).
    const rules = [rule(1, 'A', [12, 13]), rule(2, 'B', [13, 12])];
    const choice = chooseRepresentativePrimary(rules, flat);
    expect(choice).toEqual({ tagId: 10, isParentFallback: true });
  });

  it('picks any (smallest id) when tied tags do not share a parent', () => {
    // 12 (parent 10) and 22 (parent 20) tie but have different parents.
    const rules = [rule(1, 'A', [12, 22]), rule(2, 'B', [22, 12])];
    const choice = chooseRepresentativePrimary(rules, flat);
    expect(choice).toEqual({ tagId: 12, isParentFallback: false });
  });
});

describe('groupRules', () => {
  it('buckets rules with the same tag-set into one group regardless of order', () => {
    const rules = [
      rule(1, 'Reliance Fresh', [12]),
      rule(2, 'More', [12]),
      rule(3, 'Big Bazaar', [12]),
      rule(4, 'AirtelFiber', [22, 20]),
      rule(5, 'JioFiber', [20, 22]),
    ];
    const groups = groupRules(rules, flat);
    expect(groups).toHaveLength(2);
    const groceries = groups.find((g) => g.representativePrimary === 12);
    // 22 (primary on rule 4) and 20 (primary on rule 5) tie 1-1.
    // Parents differ (22's parent is 20; 20 has no parent), so the
    // shared-parent fallback doesn't kick in — tie-break picks the
    // smallest tag id (20).
    const utilities = groups.find((g) => g.representativePrimary === 20);
    expect(groceries?.rules).toHaveLength(3);
    expect(utilities?.rules).toHaveLength(2);
    // Within a group, beneficiaries are alphabetical.
    expect(groceries?.rules.map((r) => r.beneficiary_name)).toEqual([
      'Big Bazaar',
      'More',
      'Reliance Fresh',
    ]);
  });

  it('orders groups: single-rule groups first, alphabetical within each band', () => {
    // Two singletons (12 and 22) and one multi-rule group (12+22).
    // Singletons come first, sorted by rep-tag name ('Groceries' <
    // 'Internet'); multi-rule group lands at the bottom.
    const rules = [
      rule(1, 'A', [22]),
      rule(2, 'B', [12]),
      rule(3, 'C', [12, 22]),
      rule(4, 'D', [22, 12]),
    ];
    const groups = groupRules(rules, flat);
    expect(groups).toHaveLength(3);
    expect(groups[0]?.rules).toHaveLength(1);
    expect(groups[0]?.representativePrimary).toBe(12);
    expect(groups[1]?.rules).toHaveLength(1);
    expect(groups[1]?.representativePrimary).toBe(22);
    expect(groups[2]?.rules).toHaveLength(2);
  });

  it('places non-primary tags in otherTagIds sorted by id', () => {
    const rules = [rule(1, 'A', [12, 22, 13])];
    const groups = groupRules(rules, flat);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.representativePrimary).toBe(12);
    expect(groups[0]?.otherTagIds).toEqual([13, 22]);
  });
});
