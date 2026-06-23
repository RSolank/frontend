import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTaxModeStore } from '../state/taxMode.store';

import { TaxModeToggle } from './TaxModeToggle';

describe('<TaxModeToggle>', () => {
  beforeEach(() => {
    useTaxModeStore.setState({ mode: 'auto' });
  });

  afterEach(() => {
    useTaxModeStore.setState({ mode: 'auto' });
  });

  it('reflects the store value and the helper copy adapts', () => {
    render(<TaxModeToggle />);
    expect(screen.getByTestId('tax-mode-auto')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText(/Monday worker finalizes/i)).toBeInTheDocument();
  });

  it('selecting a mode updates the store and swaps the helper copy', () => {
    render(<TaxModeToggle />);

    fireEvent.click(screen.getByTestId('tax-mode-manual'));
    expect(useTaxModeStore.getState().mode).toBe('manual');
    expect(screen.getByText(/finalize them yourself/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tax-mode-off'));
    expect(useTaxModeStore.getState().mode).toBe('off');
    expect(screen.getByText(/Expense tracker only/i)).toBeInTheDocument();
  });
});
