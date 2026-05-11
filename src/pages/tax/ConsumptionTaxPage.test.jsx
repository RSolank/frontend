import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ConsumptionTaxPage } from './ConsumptionTaxPage';
import { apiFetch } from '../../utils/apiClient';

// Mock apiFetch
vi.mock('../../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../../state/AuthContext', () => ({
  useAuth: () => ({ user: { user_id: 1, first_name: 'Test', currency: '$' } })
}));

describe('ConsumptionTaxPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockBillsResponse = {
    bills: [
      { bill_id: 1, period_start: '2023-10-01', period_end: '2023-10-07', amount: 10.5, status: 'pending' },
      { bill_id: 2, period_start: '2023-09-24', period_end: '2023-09-30', amount: 5.0, status: 'paid' }
    ]
  };

  it('renders list of bills', async () => {
    apiFetch.mockResolvedValueOnce(mockBillsResponse);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ConsumptionTaxPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('2023-10-01 to 2023-10-07')).toBeInTheDocument();
      expect(screen.getByText('Status: pending • Amount: $10.50')).toBeInTheDocument();
    });
  });

  it('can generate a new bill', async () => {
    apiFetch.mockResolvedValueOnce({ bills: [] }); // initial load

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ConsumptionTaxPage />
      </MemoryRouter>
    );

    // Wait for initial load to finish (loading=false)
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Pick any date inside the week/i), { target: { value: '2023-10-05' } });
    
    apiFetch.mockResolvedValueOnce({ message: 'Bill generated' });
    apiFetch.mockResolvedValueOnce(mockBillsResponse); // reload list

    const genBtn = screen.getByText('Generate / Refresh Bills');
    expect(genBtn).not.toBeDisabled();
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/consumption-tax/bills/generate', expect.objectContaining({
        method: 'POST'
      }));
    });
  });
});
