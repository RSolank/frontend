import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TimezoneSelect } from './TimezoneSelect';

describe('TimezoneSelect', () => {
  it('renders single-tz countries as read-only with an override link', () => {
    render(
      <TimezoneSelect
        countryName="India"
        countryDefaultTimezone="Asia/Kolkata"
        value="Asia/Kolkata"
        onChange={() => {}}
        id="tz"
      />
    );

    // Display now includes the current UTC offset for clarity, e.g.
    // "Asia/Kolkata (UTC+5:30)" (Batch 9.1 Q3 enhancement).
    const input = screen.getByDisplayValue(
      /^Asia\/Kolkata(\s\(UTC.*\))?$/
    ) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(
      screen.getByRole('button', { name: /Use a different timezone/ })
    ).toBeInTheDocument();
  });

  it('expands to full IANA list when the override link is clicked', () => {
    const onChange = vi.fn();
    render(
      <TimezoneSelect
        countryName="India"
        countryDefaultTimezone="Asia/Kolkata"
        value="Asia/Kolkata"
        onChange={onChange}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Use a different timezone/ })
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(100);
  });

  it('renders a country-scoped dropdown for multi-tz countries', () => {
    render(
      <TimezoneSelect
        countryName="United States"
        countryDefaultTimezone="America/New_York"
        value="America/New_York"
        onChange={() => {}}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('America/New_York');
    expect(select.options.length).toBeGreaterThan(1);
    expect(select.options.length).toBeLessThan(100);
  });

  it('falls back to the full IANA list when the country is unknown', () => {
    render(
      <TimezoneSelect
        countryName={null}
        countryDefaultTimezone={null}
        value=""
        onChange={() => {}}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(100);
  });

  it('alwaysFullList=true renders the full IANA dropdown even with a known single-tz country', () => {
    render(
      <TimezoneSelect
        countryName="India"
        countryDefaultTimezone="Asia/Kolkata"
        value="UTC"
        onChange={() => {}}
        alwaysFullList
      />
    );
    // No read-only input, no "Use a different timezone" affordance —
    // the user lands directly on the full dropdown.
    expect(
      screen.queryByRole('button', { name: /Use a different timezone/ })
    ).not.toBeInTheDocument();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('UTC');
    expect(select.options.length).toBeGreaterThan(100);
  });
});
