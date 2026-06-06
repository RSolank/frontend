import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatRetryAfter, useRetryCountdown } from './useRetryCountdown';

function Probe({ seconds }: { seconds: number | null }) {
  const remaining = useRetryCountdown(seconds);
  return (
    <span data-testid="remaining">
      {remaining === null ? 'null' : remaining}
    </span>
  );
}

describe('useRetryCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when given null', () => {
    render(<Probe seconds={null} />);
    expect(screen.getByTestId('remaining')).toHaveTextContent('null');
  });

  it('starts at the given seconds, then ticks down once per second to zero', () => {
    render(<Probe seconds={3} />);
    expect(screen.getByTestId('remaining')).toHaveTextContent('3');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('remaining')).toHaveTextContent('2');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('remaining')).toHaveTextContent('1');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('remaining')).toHaveTextContent('0');
  });

  it('restarts the countdown when the input changes', () => {
    const { rerender } = render(<Probe seconds={3} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('remaining')).toHaveTextContent('1');

    rerender(<Probe seconds={5} />);
    expect(screen.getByTestId('remaining')).toHaveTextContent('5');
  });
});

describe('formatRetryAfter', () => {
  it('renders sub-minute values as seconds', () => {
    expect(formatRetryAfter(1)).toBe('in 1 second');
    expect(formatRetryAfter(45)).toBe('in 45 seconds');
  });

  it('renders sub-hour values as minutes (rounded up)', () => {
    expect(formatRetryAfter(60)).toBe('in 1 minute');
    expect(formatRetryAfter(61)).toBe('in 2 minutes');
    expect(formatRetryAfter(3540)).toBe('in 59 minutes');
  });

  it('renders multi-hour values as hours (rounded up)', () => {
    expect(formatRetryAfter(3600)).toBe('in 1 hour');
    expect(formatRetryAfter(3601)).toBe('in 2 hours');
    expect(formatRetryAfter(86_400)).toBe('in 24 hours');
  });
});
