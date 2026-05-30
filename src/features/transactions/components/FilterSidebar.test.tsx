import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilterSidebar } from './FilterSidebar';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the nested-ternary
// refactor (no colocated test existed). Pins the type-label rendering, the
// type/sort interactions, and the calendar-view gating.

function baseProps() {
  return {
    open: true,
    onClose: vi.fn(),
    view: 'list' as const,
    type: 'all' as const,
    tag: '',
    sortBy: 'date' as const,
    order: 'desc' as const,
    tags: [],
    onTypeChange: vi.fn(),
    onTagChange: vi.fn(),
    onSortByChange: vi.fn(),
    onOrderChange: vi.fn(),
    onClearAll: vi.fn(),
  };
}

describe('FilterSidebar', () => {
  it('renders the three type labels and fires onTypeChange on click', () => {
    const props = baseProps();
    render(<FilterSidebar {...props} />);

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Debit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Credit' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Debit' }));
    expect(props.onTypeChange).toHaveBeenCalledWith('debit');
  });

  it('reflects the active type via aria-pressed', () => {
    render(<FilterSidebar {...baseProps()} type="credit" />);
    expect(screen.getByRole('button', { name: 'Credit' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('hides Type + Sort in calendar view', () => {
    render(<FilterSidebar {...baseProps()} view="calendar" />);
    expect(screen.queryByRole('button', { name: 'Debit' })).toBeNull();
    expect(screen.queryByLabelText('Sort by')).toBeNull();
    // Tag filter stays available in every view.
    expect(screen.getByLabelText('Filter by tag')).toBeInTheDocument();
  });

  it('fires onClearAll from the footer', () => {
    const props = baseProps();
    render(<FilterSidebar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
    expect(props.onClearAll).toHaveBeenCalled();
  });
});
