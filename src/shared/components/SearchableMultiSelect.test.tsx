import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { TypeaheadOption } from '../hooks/useTypeahead';

import { SearchableMultiSelect } from './SearchableMultiSelect';

const OPTIONS: TypeaheadOption[] = [
  { value: '1', label: 'Groceries' },
  { value: '2', label: 'Dining' },
  { value: '3', label: 'Fuel' },
];

// Controlled harness mirroring a real consumer: selected values live in the
// parent, the available list excludes them, and each render rebuilds the
// `options` array (a fresh ref) to prove keyboard nav survives ref churn.
function Harness({
  onCreate,
  renderToken,
}: {
  onCreate?: () => void;
  renderToken?: never;
} = {}) {
  const [selected, setSelected] = useState<string[]>([]);
  const available = OPTIONS.filter((o) => !selected.includes(o.value)).map(
    (o) => ({ ...o })
  );
  return (
    <SearchableMultiSelect
      options={available}
      selectedValues={selected}
      onAdd={(v) => setSelected((s) => [...s, v])}
      onRemove={(v) => setSelected((s) => s.filter((x) => x !== v))}
      tokenLabel={(v) => OPTIONS.find((o) => o.value === v)?.label ?? v}
      ariaLabel="Tags"
      placeholder="Search tags…"
      onCreate={onCreate}
      createLabel="Add new tag"
      {...(renderToken ? { renderToken } : {})}
    />
  );
}

function open() {
  const input = screen.getByLabelText('Tags');
  fireEvent.focus(input);
  return input;
}

describe('SearchableMultiSelect', () => {
  it('filters the dropdown by query', () => {
    render(<Harness />);
    const input = open();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.change(input, { target: { value: 'din' } });
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent('Dining');
  });

  it('adds a chip on pick, clears the query, and drops it from the list', () => {
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: 'gro' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Groceries' }));
    // Chip rendered, query reset.
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('');
    // Re-open: the picked option is gone from the available list.
    fireEvent.focus(input);
    expect(
      screen.queryByRole('option', { name: 'Groceries' })
    ).not.toBeInTheDocument();
  });

  it('keyboard nav adds the active option (resilient to options ref churn)', () => {
    render(<Harness />);
    const input = open();
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // active -> Dining
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Dining')).toBeInTheDocument();
  });

  it('removes a chip', () => {
    render(<Harness />);
    open();
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Fuel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Fuel' }));
    expect(screen.queryByText('Fuel')).not.toBeInTheDocument();
  });

  it('fires onCreate from the inline CTA', () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    open();
    fireEvent.mouseDown(
      screen.getByRole('button', { name: /Add new tag/ })
    );
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('omits the create CTA when onCreate is absent', () => {
    render(<Harness />);
    open();
    expect(
      screen.queryByRole('button', { name: /Add new tag/ })
    ).not.toBeInTheDocument();
  });
});
