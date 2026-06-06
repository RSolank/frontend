import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BillStatusPill, isPayable, isUnpayable } from './billStatus';

describe('BillStatusPill', () => {
  it.each([
    ['ACCRUING', 'Accruing'],
    ['BILLED', 'Billed'],
    ['PAID', 'Paid'],
    ['OVERDUE', 'Overdue'],
    ['EXPIRED', 'Expired'],
  ])('renders the human label for %s', (status, label) => {
    render(<BillStatusPill status={status} />);
    expect(screen.getByTestId(`bill-status-${status}`)).toHaveTextContent(
      label
    );
  });

  it('falls back to Unknown for surprise statuses (forward-compat)', () => {
    render(<BillStatusPill status="CANCELLED" />);
    expect(screen.getByTestId('bill-status-CANCELLED')).toHaveTextContent(
      'Unknown'
    );
  });
});

describe('isPayable / isUnpayable', () => {
  it('isPayable only matches BILLED + OVERDUE', () => {
    expect(isPayable('BILLED')).toBe(true);
    expect(isPayable('OVERDUE')).toBe(true);
    expect(isPayable('ACCRUING')).toBe(false);
    expect(isPayable('PAID')).toBe(false);
    expect(isPayable('EXPIRED')).toBe(false);
  });

  it('isUnpayable only matches PAID', () => {
    expect(isUnpayable('PAID')).toBe(true);
    expect(isUnpayable('BILLED')).toBe(false);
    expect(isUnpayable('OVERDUE')).toBe(false);
    expect(isUnpayable('EXPIRED')).toBe(false);
  });
});
