import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import { apiFetch } from '../../../shared/api/apiClient';

import { TaxationRulesTab } from './TaxationRulesTab';

vi.mock('../../../shared/api/apiClient', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../../../features/auth/state/useAuth', () => ({
  useAuth: () => ({
    constants: {
      TAXABLE_TXN_TYPES: [
        'committed',
        'essential',
        'discretionary',
        'uncategorized',
      ],
    },
  }),
}));

const mockRulesResponse = {
  rules: [
    {
      txn_type: 'committed',
      tax_rate: 0.0,
      default_penalty_rate: 0.0,
      created_by: null,
      uid: 1,
    },
    {
      txn_type: 'essential',
      tax_rate: 0.05,
      default_penalty_rate: 0.1,
      created_by: null,
      uid: 2,
    },
    {
      txn_type: 'discretionary',
      tax_rate: 0.1,
      default_penalty_rate: 0.5,
      created_by: null,
      uid: 3,
    },
    {
      txn_type: 'uncategorized',
      tax_rate: 0.1,
      default_penalty_rate: 0.5,
      created_by: null,
      uid: 4,
    },
  ],
};

describe('TaxationRulesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders all 4 txn_type rows after loading', async () => {
    apiFetch.mockResolvedValueOnce(mockRulesResponse);

    render(<TaxationRulesTab />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Each txn_type should render as a capitalised "X rule" heading
    expect(screen.getByText(/committed rule/i)).toBeInTheDocument();
    expect(screen.getByText(/essential rule/i)).toBeInTheDocument();
    expect(screen.getByText(/discretionary rule/i)).toBeInTheDocument();
    expect(screen.getByText(/uncategorized rule/i)).toBeInTheDocument();
  });

  it('pre-fills tax rate inputs from the API response', async () => {
    apiFetch.mockResolvedValueOnce(mockRulesResponse);

    render(<TaxationRulesTab />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Each row has a "Tax Rate:" label; find all inputs after that label
    const taxRateInputs = screen.getAllByDisplayValue('0.05');
    expect(taxRateInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('saves an updated rule via PUT on Save click', async () => {
    apiFetch.mockResolvedValueOnce(mockRulesResponse); // initial load
    apiFetch.mockResolvedValueOnce({
      rule: { uid: 3, txn_type: 'discretionary' },
    }); // PUT
    apiFetch.mockResolvedValueOnce(mockRulesResponse); // reload after save

    render(<TaxationRulesTab />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Find all Tax Rate inputs and change the discretionary one (value '0.1')
    const taxInputs = screen.getAllByDisplayValue('0.1');
    fireEvent.change(taxInputs[0], { target: { value: '0.12' } });

    // Click Save — there are 4 Save buttons, one per row. Click the first one that's for discretionary.
    const saveBtns = screen.getAllByText('Save');
    fireEvent.click(saveBtns[2]); // discretionary is 3rd (index 2)

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/taxation-rules/discretionary',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"tax_rate"'),
        })
      );
    });
  });
});
