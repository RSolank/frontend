import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  defaultTypeaheadFilter,
  useTypeahead,
  type TypeaheadOption,
} from './useTypeahead';

const OPTIONS: TypeaheadOption[] = [
  { value: '1', label: 'Groceries', keywords: 'Total > Essential' },
  { value: '2', label: 'Dining' },
];

describe('defaultTypeaheadFilter', () => {
  it('matches the visible label case-insensitively', () => {
    expect(defaultTypeaheadFilter(OPTIONS[0]!, 'GROC')).toBe(true);
    expect(defaultTypeaheadFilter(OPTIONS[0]!, 'dining')).toBe(false);
  });

  it('also matches hidden keywords', () => {
    // "essential" appears only in keywords, not the label.
    expect(defaultTypeaheadFilter(OPTIONS[0]!, 'essential')).toBe(true);
  });

  it('an empty query matches everything', () => {
    expect(defaultTypeaheadFilter(OPTIONS[1]!, '  ')).toBe(true);
  });
});

describe('useTypeahead', () => {
  it('filters by query and exposes the narrowed list', () => {
    const { result } = renderHook(() =>
      useTypeahead({ options: OPTIONS, onPick: vi.fn() })
    );
    expect(result.current.filtered).toHaveLength(2);
    act(() => result.current.setQuery('din'));
    expect(result.current.filtered.map((o) => o.label)).toEqual(['Dining']);
  });

  it('pick fires onPick, clears the query, and closes by default', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() => useTypeahead({ options: OPTIONS, onPick }));
    act(() => {
      result.current.setOpen(true);
      result.current.setQuery('gro');
    });
    act(() => result.current.pick(OPTIONS[0]!));
    expect(onPick).toHaveBeenCalledWith(OPTIONS[0]);
    expect(result.current.query).toBe('');
    expect(result.current.open).toBe(false);
  });

  it('closeOnPick=false keeps the dropdown open after a pick', () => {
    const { result } = renderHook(() =>
      useTypeahead({ options: OPTIONS, onPick: vi.fn(), closeOnPick: false })
    );
    act(() => result.current.setOpen(true));
    act(() => result.current.pick(OPTIONS[0]!));
    expect(result.current.open).toBe(true);
  });
});
