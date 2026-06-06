import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTaxModeStore } from '../state/taxMode.store';

import { TaxModeToggle } from './TaxModeToggle';

describe('<TaxModeToggle>', () => {
  beforeEach(() => {
    useTaxModeStore.setState({ enabled: true });
  });

  afterEach(() => {
    useTaxModeStore.setState({ enabled: true });
  });

  it('reflects the store value and the helper copy adapts', () => {
    render(<TaxModeToggle />);
    expect(screen.getByTestId('tax-mode-toggle')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText(/Monday worker finalizes/i)).toBeInTheDocument();
  });

  it('toggles the store on click and swaps the helper copy', () => {
    render(<TaxModeToggle />);
    fireEvent.click(screen.getByTestId('tax-mode-toggle'));
    expect(useTaxModeStore.getState().enabled).toBe(false);
    expect(screen.getByText(/Bills stay in Accruing/i)).toBeInTheDocument();
  });
});
