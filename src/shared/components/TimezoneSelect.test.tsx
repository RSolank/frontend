import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/renderWithProviders';

import { TimezoneSelect } from './TimezoneSelect';

// `<TimezoneSelect>` reads from `useCountriesQuery` + `useTimezonesQuery`
// after Platform FE Batch 4. The shared MSW handlers serve India (single
// tz) + the US (multi-tz) + a 9-entry IANA list large enough to verify
// "country-scoped vs full" without scanning hundreds of options.
describe('TimezoneSelect', () => {
  it('renders single-tz countries as read-only with an override link', async () => {
    renderWithProviders(
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
    const input = (await screen.findByDisplayValue(
      /^Asia\/Kolkata(\s\(UTC.*\))?$/
    )) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(
      screen.getByRole('button', { name: /Use a different timezone/ })
    ).toBeInTheDocument();
  });

  it('expands to full IANA list when the override link is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TimezoneSelect
        countryName="India"
        countryDefaultTimezone="Asia/Kolkata"
        value="Asia/Kolkata"
        onChange={onChange}
      />
    );

    await screen.findByRole('button', { name: /Use a different timezone/ });
    fireEvent.click(
      screen.getByRole('button', { name: /Use a different timezone/ })
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // The MSW handler returns the full IANA list including non-Indian
    // zones — verifying the dropdown's scope flipped from
    // country-scoped to all-IANA.
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain('Asia/Kolkata');
    expect(optionValues).toContain('America/New_York');
    expect(optionValues).toContain('Europe/Berlin');
    expect(optionValues).toContain('UTC');
  });

  it('renders a country-scoped dropdown for multi-tz countries', async () => {
    renderWithProviders(
      <TimezoneSelect
        countryName="United States"
        countryDefaultTimezone="America/New_York"
        value="America/New_York"
        onChange={() => {}}
      />
    );

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.options.length).toBeGreaterThan(1);
    });
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('America/New_York');
    // US has 5 timezones in the metadata payload — the country-scoped
    // dropdown should match exactly that.
    expect(select.options.length).toBe(5);
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain('America/New_York');
    expect(optionValues).toContain('America/Los_Angeles');
    expect(optionValues).not.toContain('Europe/Berlin');
  });

  it('falls back to the full IANA list when the country is unknown', async () => {
    renderWithProviders(
      <TimezoneSelect
        countryName={null}
        countryDefaultTimezone={null}
        value=""
        onChange={() => {}}
      />
    );
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      // Full IANA reach — assert we see zones from multiple continents.
      expect(values).toContain('Asia/Kolkata');
      expect(values).toContain('Europe/Berlin');
      expect(values).toContain('America/New_York');
    });
  });

  it('alwaysFullList=true renders the full IANA dropdown even with a known single-tz country', async () => {
    renderWithProviders(
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
    const select = await waitFor(() => {
      const s = screen.getByRole('combobox') as HTMLSelectElement;
      expect(s.value).toBe('UTC');
      return s;
    });
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('Europe/Berlin');
    expect(values).toContain('America/Los_Angeles');
  });
});
