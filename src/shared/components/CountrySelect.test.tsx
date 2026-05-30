import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/renderWithProviders';

import {
  COUNTRY_PREFER_NOT_SAY,
  CountrySelect,
  formatCountryOption,
} from './CountrySelect';

const COUNTRIES = [
  {
    name: 'India',
    country_code: '+91',
    default_currency: 'INR',
    timezone: 'Asia/Kolkata',
  },
  {
    name: 'United States',
    country_code: '+1',
    default_currency: 'USD',
    timezone: 'America/New_York',
  },
];

// Post-Batch-9.8: migrated to SearchableSelect. Options only render
// once the typeahead input gains focus; the combobox is a text input,
// not a native <select>.
describe('CountrySelect', () => {
  it('emits the full CountryOption alongside the value on selection', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountrySelect value="" onChange={onChange} countries={COUNTRIES} />
    );
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.mouseDown(
      screen.getByRole('option', { name: '(+91) India' })
    );
    expect(onChange).toHaveBeenCalledWith(
      'India',
      expect.objectContaining({ name: 'India', timezone: 'Asia/Kolkata' })
    );
  });

  it('emits null for the prefer-not-say sentinel', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CountrySelect value="" onChange={onChange} countries={COUNTRIES} />
    );
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.mouseDown(
      screen.getByRole('option', { name: 'Rather not say' })
    );
    expect(onChange).toHaveBeenCalledWith(COUNTRY_PREFER_NOT_SAY, null);
  });

  it('renders `(dialCode) name` so users see the dial-code prefix', () => {
    renderWithProviders(
      <CountrySelect value="" onChange={() => {}} countries={COUNTRIES} />
    );
    fireEvent.focus(screen.getByRole('combobox'));
    expect(
      screen.getByRole('option', { name: '(+91) India' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: '(+1) United States' })
    ).toBeInTheDocument();
  });

  it('formatCountryOption falls back to just the name when dial code is missing', () => {
    expect(
      formatCountryOption({
        name: 'India',
        country_code: '+91',
        default_currency: 'INR',
        timezone: 'Asia/Kolkata',
      })
    ).toBe('(+91) India');
    expect(formatCountryOption({ name: 'Mystery' })).toBe('Mystery');
  });

  it('hides the prefer-not-say option when disabled', () => {
    renderWithProviders(
      <CountrySelect
        value=""
        onChange={() => {}}
        countries={COUNTRIES}
        allowPreferNotSay={false}
      />
    );
    fireEvent.focus(screen.getByRole('combobox'));
    expect(
      screen.queryByRole('option', { name: 'Rather not say' })
    ).not.toBeInTheDocument();
  });
});
