import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useTypeaheadKeyboard } from './useTypeaheadKeyboard';

function Harness({
  itemCount,
  onSelect,
}: {
  itemCount: number;
  onSelect: (i: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const { activeIndex, handleKeyDown } = useTypeaheadKeyboard({
    itemCount,
    open,
    setOpen,
    onSelect,
    resetSignal: '',
  });
  return (
    <div>
      <input data-testid="input" onKeyDown={handleKeyDown} />
      <div data-testid="active">{activeIndex}</div>
      <div data-testid="open">{String(open)}</div>
    </div>
  );
}

function setup(itemCount = 3) {
  const onSelect = vi.fn();
  render(<Harness itemCount={itemCount} onSelect={onSelect} />);
  return { onSelect, input: screen.getByTestId('input') };
}

describe('useTypeaheadKeyboard', () => {
  it('ArrowDown advances and wraps', () => {
    const { input } = setup(3);
    expect(screen.getByTestId('active').textContent).toBe('0');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('active').textContent).toBe('1');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 2 -> wrap to 0
    expect(screen.getByTestId('active').textContent).toBe('0');
  });

  it('ArrowUp wraps to the last option', () => {
    const { input } = setup(3);
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // 0 -> 2
    expect(screen.getByTestId('active').textContent).toBe('2');
  });

  it('Enter selects the active option', () => {
    const { input, onSelect } = setup(3);
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // active 1
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('Escape closes the dropdown', () => {
    const { input } = setup(3);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('no-ops Enter when there are no options', () => {
    const { input, onSelect } = setup(0);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
