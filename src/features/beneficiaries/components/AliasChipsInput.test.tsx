import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { server } from '../../../test/server';

import { AliasChipsInput } from './AliasChipsInput';

describe('AliasChipsInput', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_BASE}/beneficiaries/check-alias`, ({ request }) => {
        const url = new URL(request.url);
        const alias = url.searchParams.get('alias') ?? '';
        const unique = alias === 'EKART';
        return HttpResponse.json({ alias, unique });
      })
    );
  });

  it('debounces realtime uniqueness check and blocks taken aliases', async () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();

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

    expect(screen.getByRole('button', { name: 'Add alias' })).toBeDisabled();
  });

  it('adds chip when alias is unique', async () => {
    const onChange = vi.fn();
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
