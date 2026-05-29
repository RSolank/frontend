import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

import {
  CurrencySelect,
  formatCurrencyOption,
} from './CurrencySelect';

const CURRENCIES = [
  { code: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { code: 'XYZ', label: 'Non-standard code', symbol: null },
];

// Post-Batch-9.8: migrated to SearchableSelect. Options only render
// once the typeahead input gains focus; the combobox is a text input,
// not a native <select>.
describe('CurrencySelect', () => {
  it('renders `${label} (${symbol})` for currencies with a symbol', () => {
    renderWithProviders(
      <CurrencySelect value="" onChange={() => {}} currencies={CURRENCIES} />
    );
    fireEvent.focus(screen.getByRole('combobox'));
    expect(
      screen.getByRole('option', { name: 'INR - Indian Rupee (₹)' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'USD - US Dollar ($)' })
    ).toBeInTheDocument();
  });

  it('falls back to just `${label}` when the symbol is null', () => {
    renderWithProviders(
      <CurrencySelect value="" onChange={() => {}} currencies={CURRENCIES} />
    );
    fireEvent.focus(screen.getByRole('combobox'));
    expect(
      screen.getByRole('option', { name: 'Non-standard code' })
    ).toBeInTheDocument();
  });

  it('emits the selected code', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CurrencySelect value="" onChange={onChange} currencies={CURRENCIES} />
    );
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.mouseDown(
      screen.getByRole('option', { name: 'USD - US Dollar ($)' })
    );
    expect(onChange).toHaveBeenCalledWith('USD');
  });

  it('formatCurrencyOption is a pure helper for the dropdown label', () => {
    expect(
      formatCurrencyOption({
        code: 'INR',
        label: 'INR - Indian Rupee',
        symbol: '₹',
      })
    ).toBe('INR - Indian Rupee (₹)');
    expect(
      formatCurrencyOption({
        code: 'XYZ',
        label: 'Non-standard code',
        symbol: null,
      })
    ).toBe('Non-standard code');
  });
});
