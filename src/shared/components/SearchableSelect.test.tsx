import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SearchableSelect } from './SearchableSelect';

const OPTIONS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
];

describe('SearchableSelect keyboard navigation', () => {
  it('ArrowDown advances the active option (stable options)', () => {
    render(
      <SearchableSelect
        value=""
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="Fruit"
        id="fruit"
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 0 -> 1
    expect(input).toHaveAttribute('aria-activedescendant', 'fruit-opt-b');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 1 -> 2
    expect(input).toHaveAttribute('aria-activedescendant', 'fruit-opt-c');
  });

  it('ArrowDown advances after filtering (type then navigate)', () => {
    render(
      <SearchableSelect
        value=""
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="Fruit"
        id="fruit"
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a' } }); // Apple, Banana
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 0 -> 1 (Banana)
    expect(input).toHaveAttribute('aria-activedescendant', 'fruit-opt-b');
  });

  it('ArrowDown advances even when the parent rebuilds options each render', () => {
    // Simulates a consumer that passes a freshly-built options array on
    // every render (the common `options={data.map(...)}` pattern) AND
    // re-renders frequently (here: a parent counter bumped on each change).
    function Parent() {
      const [, setTick] = useState(0);
      return (
        <div>
          <button onClick={() => setTick((t) => t + 1)}>tick</button>
          <SearchableSelect
            value=""
            options={OPTIONS.map((o) => ({ ...o }))}
            onChange={() => {}}
            ariaLabel="Fruit"
            id="fruit"
          />
        </div>
      );
    }
    render(<Parent />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 0 -> 1
    // Force a parent re-render (new options ref) mid-navigation.
    fireEvent.click(screen.getByText('tick'));
    expect(input).toHaveAttribute('aria-activedescendant', 'fruit-opt-b');
  });

  it('Enter picks the active option', () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        options={OPTIONS}
        onChange={onChange}
        ariaLabel="Fruit"
        id="fruit"
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // Banana
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
