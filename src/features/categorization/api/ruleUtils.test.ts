import { describe, expect, it } from 'vitest';

import type { TagNode } from '../../tags/api/queries';

import {
  buildRuleName,
  flattenTags,
  formatTagAssignment,
} from './ruleUtils';

const tree: TagNode[] = [
  {
    tag_id: 10,
    tag_name: 'Food',
    parent: null,
    tag_type: 'essential',
    aliases: [],
    created_by: null,
    children: [
      {
        tag_id: 12,
        tag_name: 'Groceries',
        parent: 10,
        tag_type: 'essential',
        aliases: [],
        created_by: null,
        children: [],
      },
    ],
  },
  {
    tag_id: 20,
    tag_name: 'Utilities',
    parent: null,
    tag_type: 'committed',
    aliases: [],
    created_by: null,
    children: [
      {
        tag_id: 22,
        tag_name: 'Internet',
        parent: 20,
        tag_type: 'committed',
        aliases: [],
        created_by: null,
        children: [],
      },
    ],
  },
];

const flat = flattenTags(tree);

describe('categorization ruleUtils', () => {
  it('formatTagAssignment uses parent (child) syntax', () => {
    expect(formatTagAssignment(12, flat)).toBe('Food (Groceries)');
  });

  it('formatTagAssignment falls back to top-level name when no parent', () => {
    expect(formatTagAssignment(10, flat)).toBe('Food');
  });

  it('formatTagAssignment returns id as string when tag missing', () => {
    expect(formatTagAssignment(999, flat)).toBe('999');
  });

  it('buildRuleName uses ONLY the primary (index 0) when multiple tags exist', () => {
    expect(buildRuleName('TestShop', [12, 22], flat)).toBe(
      'TestShop -> Food (Groceries)'
    );
  });

  it('buildRuleName updates when the primary changes (different tag at index 0)', () => {
    expect(buildRuleName('TestShop', [22, 12], flat)).toBe(
      'TestShop -> Utilities (Internet)'
    );
  });

  it('buildRuleName returns just the beneficiary name when no tags are picked yet', () => {
    expect(buildRuleName('TestShop', [], flat)).toBe('TestShop');
  });

  it('buildRuleName returns empty string with blank beneficiary', () => {
    expect(buildRuleName('   ', [12], flat)).toBe('');
  });
});
