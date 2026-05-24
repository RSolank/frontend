import { describe, it, expect } from 'vitest';

import { formatAliasesDisplay, buildAliasCheckUrl } from './aliasUtils.js';

describe('aliasUtils', () => {
  it('formatAliasesDisplay returns parenthesized comma-separated values', () => {
    expect(formatAliasesDisplay(['Jio', 'Airtel'])).toBe('(Jio, Airtel)');
    expect(formatAliasesDisplay([])).toBe('');
    expect(formatAliasesDisplay(null)).toBe('');
  });

  it('buildAliasCheckUrl encodes alias and optional exclude uid', () => {
    expect(buildAliasCheckUrl('Jio')).toBe(
      '/api/beneficiaries/check-alias?alias=Jio'
    );
    expect(buildAliasCheckUrl('Jio', 5)).toBe(
      '/api/beneficiaries/check-alias?alias=Jio&exclude_uid=5'
    );
  });
});
