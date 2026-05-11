import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ConsumptionTaxTab } from './ConsumptionTaxTab';
import { apiFetch } from '../../utils/apiClient';

vi.mock('../../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../../state/AuthContext', () => ({
  useAuth: () => ({
    user: { currency: '$' }
  })
}));

const mockBillsResponse = {
  bills: [
    {
      bill_id: 1,
      amount: 120.5,
      status: 'pending',
      period_start: '2023-10-01',
      period_end: '2023-10-31',
      last_updated: '2023-11-01T10:00:00'
    }
  ]
};

const mockBillDetailResponse = {
  bill_id: 1,
  amount: 120.5,
  status: 'pending',
  period_start: '2023-10-01',
  period_end: '2023-10-31',
  items: [
    {
      txn_id: 101,
      date: '2023-10-15',
      merchant: 'Test Store',
      amount: 1000.0,
      debit_credit: 'debit',
      txn_type: 'discretionary',
      tax_amount: 100.0,
      penalty: 20.5
    }
  ],
  totals: {
    tax_total: 100.0,
    penalty_total: 20.5
  }
};

describe('ConsumptionTaxTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders bill list and allows viewing details', async () => {
    apiFetch.mockResolvedValueOnce(mockBillsResponse);

    render(<ConsumptionTaxTab />);

    await waitFor(() => {
      expect(screen.getByText(/2023-10-01 to 2023-10-31/i)).toBeInTheDocument();
      expect(screen.getByText(/120.5/)).toBeInTheDocument();
    });

    // Mock detail fetch
    apiFetch.mockResolvedValueOnce(mockBillDetailResponse);

    fireEvent.click(screen.getByText('View'));

    await screen.findByText(/2023-10-15/i, {}, { timeout: 5000 });
    expect(screen.getByText(/Test Store/i)).toBeInTheDocument();
    expect(screen.getAllByText(/100\.00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows paying a bill', async () => {
    apiFetch.mockResolvedValueOnce(mockBillsResponse);
    render(<ConsumptionTaxTab />);

    await waitFor(() => expect(screen.getByText('Pay')).toBeInTheDocument());

    apiFetch.mockResolvedValueOnce({ status: 'paid', bill_id: 1 });
    apiFetch.mockResolvedValueOnce({ bills: [{ ...mockBillsResponse.bills[0], status: 'paid' }] });

    fireEvent.click(screen.getByText('Pay'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/consumption-tax/bills/1/pay', expect.objectContaining({
        method: 'POST'
      }));
    });
  });
});
