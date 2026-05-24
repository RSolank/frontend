import { describe, it, expect } from 'vitest';

import {
  buildRuleName,
  formatTagAssignment,
  flattenTags,
} from './categorizationRuleUtils.js';

const flatTags = flattenTags([
  {
    tag_id: 10,
    tag_name: 'Food',
    parent: null,
    children: [{ tag_id: 12, tag_name: 'Groceries', parent: 10, children: [] }],
  },
  {
    tag_id: 20,
    tag_name: 'Utilities',
    parent: null,
    children: [{ tag_id: 22, tag_name: 'Internet', parent: 20, children: [] }],
  },
]);

describe('categorizationRuleUtils', () => {
  it('formatTagAssignment uses parent (child) syntax', () => {
    expect(formatTagAssignment(12, flatTags)).toBe('Food (Groceries)');
  });

  it('buildRuleName joins multiple tag assignments', () => {
    expect(buildRuleName('TestShop', [12, 22], flatTags)).toBe(
      'TestShop -> Food (Groceries), Utilities (Internet)'
    );
  });
});
