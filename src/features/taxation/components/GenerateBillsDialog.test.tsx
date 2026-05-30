import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateBillsRequest } from '../api/mutations';

import { GenerateBillsDialog } from './GenerateBillsDialog';

// Behaviour coverage added in Batch 10.11 round-2, alongside the
// useGenerateBills() view-model extraction. No colocated test existed. The
// generate mutation is mocked; the billPeriod date helpers run for real
// (the asserted cases don't depend on "today").
vi.mock('../api/mutations', () => ({ generateBillsRequest: vi.fn() }));

const mockGenerate = vi.mocked(generateBillsRequest);

function renderDialog() {
  render(
    <GenerateBillsDialog
      open
      onClose={vi.fn()}
      onGenerated={vi.fn()}
      timezone="Asia/Kolkata"
    />
  );
}

describe('GenerateBillsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue({ bill_ids: [] } as never);
  });

  it('defaults to the week-picker mode', () => {
    renderDialog();
    expect(screen.getByText('Pick a week')).toBeInTheDocument();
    expect(screen.getByTestId('generate-week-input')).toBeInTheDocument();
  });

  it('switches to date-range mode and shows the two period fields', () => {
    renderDialog();
    expect(screen.getByTestId('generate-week-input')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Date range/ }));
    // Week picker is replaced by the two period inputs.
    expect(screen.queryByTestId('generate-week-input')).not.toBeInTheDocument();
    expect(screen.getByText('Period start')).toBeInTheDocument();
    expect(screen.getByText('Period end')).toBeInTheDocument();
  });

  it('blocks generation and shows an error when no week is picked', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Generate / refresh' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a week first.');
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
