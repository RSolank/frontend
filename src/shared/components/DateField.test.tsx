import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DateField } from './DateField';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the day-cell
// nested-ternary refactor (no colocated test existed). Pins typed-commit,
// invalid-snapback, and calendar pick behaviour.

describe('DateField', () => {
  it('commits a typed valid ISO date on blur', () => {
    const onChange = vi.fn();
    render(<DateField value="" onChange={onChange} ariaLabel="Date" />);
    const input = screen.getByLabelText('Date');
    fireEvent.change(input, { target: { value: '2026-05-15' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('2026-05-15');
  });

  it('rejects an invalid date and snaps the field back to the last value', () => {
    const onChange = vi.fn();
    render(<DateField value="2026-05-15" onChange={onChange} ariaLabel="Date" />);
    const input = screen.getByLabelText('Date') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-02-31' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('2026-05-15');
  });

  it('opens the calendar and fires onChange for the picked day', async () => {
    const onChange = vi.fn();
    render(<DateField value="2026-05-15" onChange={onChange} ariaLabel="Date" />);
    fireEvent.click(screen.getByLabelText('Open calendar'));
    fireEvent.click(await screen.findByLabelText('2026-05-20'));
    expect(onChange).toHaveBeenCalledWith('2026-05-20');
  });

  it('marks the selected day via aria-pressed', () => {
    render(<DateField value="2026-05-15" onChange={() => {}} ariaLabel="Date" />);
    fireEvent.click(screen.getByLabelText('Open calendar'));
    expect(screen.getByLabelText('2026-05-15')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  // Locks the viewMonth nav state, relocated into DateCalendarPopup in the
  // Batch 10.11 round-2 max-lines split. April 15 isn't in the May grid;
  // stepping back a month brings it into view.
  it('steps the visible month with the previous-month control', async () => {
    render(<DateField value="2026-05-15" onChange={() => {}} ariaLabel="Date" />);
    fireEvent.click(screen.getByLabelText('Open calendar'));
    expect(screen.queryByLabelText('2026-04-15')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(await screen.findByLabelText('2026-04-15')).toBeInTheDocument();
  });
});
