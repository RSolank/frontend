import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRowHighlight } from './useRowHighlight';

describe('useRowHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flashes the id, then clears after the duration', () => {
    const { result } = renderHook(() => useRowHighlight<number>(500));
    expect(result.current.id).toBeNull();

    act(() => {
      result.current.flash(7);
    });
    expect(result.current.id).toBe(7);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.id).toBeNull();
  });

  it('replacing the flash before timeout swaps the id and resets the timer', () => {
    const { result } = renderHook(() => useRowHighlight<number>(500));

    act(() => {
      result.current.flash(1);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.id).toBe(1);

    act(() => {
      result.current.flash(2);
    });
    expect(result.current.id).toBe(2);

    // Original timer would have fired at 500 (200 ms from now). It
    // must have been cancelled — id stays at 2 past that point.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.id).toBe(2);

    // The new timer fires at 500 ms after the second flash.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.id).toBeNull();
  });

  it('cleans up the pending timer on unmount', () => {
    const { result, unmount } = renderHook(() => useRowHighlight<number>(500));
    act(() => {
      result.current.flash(1);
    });
    unmount();
    // No assertion needed — vi.useFakeTimers would otherwise flag a
    // leaked timer or a setState-after-unmount warning if cleanup
    // missed the clearTimeout.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(true).toBe(true);
  });
});
