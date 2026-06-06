import { describe, expect, test } from 'vitest';

import { matchParserByFilename } from './parserMatch';
import { HARDCODED_PARSER_CATALOG, type ParserOption } from './schemas';

const ICICI: ParserOption = {
  key: 'icici',
  label: 'ICICI savings (CSV)',
  source_type: 'icici',
};

describe('matchParserByFilename', () => {
  test('matches PhonePe statement filename to phonepe parser', () => {
    const match = matchParserByFilename(
      'phonepe-statement-may-2026.pdf',
      HARDCODED_PARSER_CATALOG
    );
    expect(match?.key).toBe('phonepe');
  });

  test('matches case-insensitively', () => {
    const match = matchParserByFilename(
      'PhonePe-Statement.pdf',
      HARDCODED_PARSER_CATALOG
    );
    expect(match?.key).toBe('phonepe');
  });

  test('matches by first label word when key/source not present', () => {
    // The PhonePe label first word is "phonepe", same as key — so
    // this test pushes the first-label-word branch by introducing
    // a synthetic parser whose label starts with a unique word.
    const parsers: ParserOption[] = [
      { key: 'abc', label: 'Acme Savings (CSV)', source_type: 'xyz' },
    ];
    const match = matchParserByFilename('acme-export.csv', parsers);
    expect(match?.key).toBe('abc');
  });

  test('matches future parsers added to the catalog without code changes', () => {
    const match = matchParserByFilename('icici-savings-april.csv', [
      ...HARDCODED_PARSER_CATALOG,
      ICICI,
    ]);
    expect(match?.key).toBe('icici');
  });

  test('returns null for generic filenames with no parser signal', () => {
    expect(
      matchParserByFilename('statement.pdf', HARDCODED_PARSER_CATALOG)
    ).toBeNull();
    expect(
      matchParserByFilename('export-2026.csv', HARDCODED_PARSER_CATALOG)
    ).toBeNull();
  });

  test('returns null for an empty filename', () => {
    expect(matchParserByFilename('', HARDCODED_PARSER_CATALOG)).toBeNull();
  });

  test('first-registered wins on tie (mirrors BE tie-break)', () => {
    // Two synthetic parsers whose keys both appear in the
    // filename stem. Registration order wins → first match.
    const parsers: ParserOption[] = [
      { key: 'alpha', label: 'Alpha bank', source_type: 'alpha' },
      { key: 'beta', label: 'Beta bank', source_type: 'beta' },
    ];
    const match = matchParserByFilename('alpha-beta-export.csv', parsers);
    expect(match?.key).toBe('alpha');
  });

  test('ignores extension-only false positives', () => {
    // `csv` key would match the `.csv` extension if we matched the
    // raw filename; stripping the trailing extension prevents that.
    expect(
      matchParserByFilename('budget.csv', HARDCODED_PARSER_CATALOG)
    ).toBeNull();
  });
});
