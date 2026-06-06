import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { RecurringStatusChip } from './RecurringStatusChip';

describe('RecurringStatusChip', () => {
  test('renders user-facing label for candidate status', () => {
    render(<RecurringStatusChip status="candidate" />);
    expect(screen.getByTestId('recurring-status-candidate')).toHaveTextContent(
      'Detected'
    );
  });

  test('renders user-facing label for review status', () => {
    render(<RecurringStatusChip status="review" />);
    expect(screen.getByTestId('recurring-status-review')).toHaveTextContent(
      'Needs attention'
    );
  });

  test('renders user-facing label for locked status', () => {
    render(<RecurringStatusChip status="locked" />);
    expect(screen.getByTestId('recurring-status-locked')).toHaveTextContent(
      'Confirmed'
    );
  });
});
