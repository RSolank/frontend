import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { apiFetch } from '../../utils/apiClient.js';

import { AliasChipsInput } from './AliasChipsInput.jsx';

vi.mock('../../utils/apiClient.js', () => ({
  apiFetch: vi.fn(),
}));

describe('AliasChipsInput', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debounces realtime uniqueness check and blocks taken aliases', async () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();

    apiFetch.mockResolvedValue({ alias: 'Jio', unique: false });

    render(
      <AliasChipsInput
        aliases={[]}
        onChange={onChange}
        excludeUid={1}
        onValidityChange={onValidityChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Enter alias/i), {
      target: { value: 'Jio' },
    });

    await waitFor(() => {
      expect(screen.getByText('Alias already in use')).toBeInTheDocument();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/beneficiaries/check-alias?alias=Jio&exclude_uid=1'
      )
    );
    expect(screen.getByRole('button', { name: 'Add alias' })).toBeDisabled();
  });

  it('adds chip when alias is unique', async () => {
    const onChange = vi.fn();
    apiFetch.mockResolvedValue({ alias: 'EKART', unique: true });

    render(<AliasChipsInput aliases={[]} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText(/Enter alias/i), {
      target: { value: 'EKART' },
    });

    await waitFor(() => {
      expect(screen.getByText('Alias is available')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add alias' })
      ).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add alias' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['EKART']);
    });
  });
});
