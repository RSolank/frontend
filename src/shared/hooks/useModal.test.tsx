import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import { useModal, useUrlValueModal } from './useModal';

function wrapper(initial: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
  };
}

describe('useModal (local mode)', () => {
  it('opens and closes via local state', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: wrapper('/'),
    });
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });
});

describe('useModal (URL mode)', () => {
  it('mirrors open state into the search param', () => {
    const { result } = renderHook(() => useModal({ urlKey: 'add' }), {
      wrapper: wrapper('/'),
    });
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('reads initial open state from the URL', () => {
    const { result } = renderHook(() => useModal({ urlKey: 'add' }), {
      wrapper: wrapper('/transactions?add=true'),
    });
    expect(result.current.isOpen).toBe(true);
  });
});

describe('useUrlValueModal', () => {
  it('returns the URL param as value and isOpen=true when present', () => {
    const { result } = renderHook(() => useUrlValueModal('edit'), {
      wrapper: wrapper('/transactions?edit=42'),
    });
    expect(result.current.value).toBe('42');
    expect(result.current.isOpen).toBe(true);
  });

  it('opens with a new value and closes by removing the key', () => {
    const { result } = renderHook(() => useUrlValueModal('edit'), {
      wrapper: wrapper('/'),
    });
    expect(result.current.value).toBeNull();
    act(() => result.current.openWith('7'));
    expect(result.current.value).toBe('7');
    act(() => result.current.close());
    expect(result.current.value).toBeNull();
  });
});
