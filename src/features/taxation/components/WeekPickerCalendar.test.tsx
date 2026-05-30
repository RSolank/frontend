import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WeekPickerCalendar } from './WeekPickerCalendar';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the nested-ternary
// refactor (the component had no colocated test). Pins the billable gate +
// selection behaviour; dates are derived from the real "today" so assertions
// stay structural (row count, disabled state, onSelect payload) rather than
// pinning specific calendar dates.

const FAR_FUTURE = '2099-12-31'; // every visible week ends before this -> billable
const FAR_PAST = '1970-01-01'; // no week ends before this -> none billable

describe('WeekPickerCalendar', () => {
  it('renders six ISO week rows for the visible month', () => {
    render(
      <WeekPickerCalendar
        selectedWeekStart={null}
        onSelect={() => {}}
        timezone="UTC"
        precedingWeekStart={FAR_FUTURE}
      />
    );
    expect(screen.getAllByTestId(/^week-row-/)).toHaveLength(6);
  });

  it('clicking a billable week fires onSelect with that week’s Monday', () => {
    const onSelect = vi.fn();
    render(
      <WeekPickerCalendar
        selectedWeekStart={null}
        onSelect={onSelect}
        timezone="UTC"
        precedingWeekStart={FAR_FUTURE}
      />
    );
    const first = screen.getAllByTestId(/^week-row-/)[0]!;
    const iso = first.getAttribute('data-testid')!.replace('week-row-', '');
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith(iso);
  });

  it('non-billable weeks render disabled and do not fire onSelect', () => {
    const onSelect = vi.fn();
    render(
      <WeekPickerCalendar
        selectedWeekStart={null}
        onSelect={onSelect}
        timezone="UTC"
        precedingWeekStart={FAR_PAST}
      />
    );
    const rows = screen.getAllByTestId(/^week-row-/);
    rows.forEach((r) => expect(r).toBeDisabled());
    fireEvent.click(rows[0]!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the selected week via aria-pressed', () => {
    const { rerender } = render(
      <WeekPickerCalendar
        selectedWeekStart={null}
        onSelect={() => {}}
        timezone="UTC"
        precedingWeekStart={FAR_FUTURE}
      />
    );
    const iso = screen
      .getAllByTestId(/^week-row-/)[0]!
      .getAttribute('data-testid')!
      .replace('week-row-', '');
    rerender(
      <WeekPickerCalendar
        selectedWeekStart={iso}
        onSelect={() => {}}
        timezone="UTC"
        precedingWeekStart={FAR_FUTURE}
      />
    );
    expect(screen.getByTestId(`week-row-${iso}`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
