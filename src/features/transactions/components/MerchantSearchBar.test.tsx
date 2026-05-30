import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MerchantSearchBar } from './MerchantSearchBar';

// Smoke / behaviour coverage added in Batch 10.11 ahead of the nested-ternary
// refactor (no colocated test existed). fetchBeneficiaries has no global MSW
// handler, so it's mocked here to supply a deterministic list.
vi.mock('../../beneficiaries/api/queries', () => ({
  fetchBeneficiaries: () =>
    Promise.resolve([
      { uid: 1, name: 'Amazon', aliases: [] },
      { uid: 2, name: 'Netflix', aliases: [] },
    ]),
}));

describe('MerchantSearchBar', () => {
  it('opens the dropdown on focus and lists beneficiaries', async () => {
    render(<MerchantSearchBar beneficiaryId="" onChange={() => {}} />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Search merchant' }));
    expect(await screen.findByRole('option', { name: 'Amazon' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Netflix' })).toBeInTheDocument();
  });

  it('selecting an option fires onChange with the beneficiary uid', async () => {
    const onChange = vi.fn();
    render(<MerchantSearchBar beneficiaryId="" onChange={onChange} />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Search merchant' }));
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Netflix' }));
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('filters the list by the typed query', async () => {
    render(<MerchantSearchBar beneficiaryId="" onChange={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Search merchant' });
    fireEvent.focus(input);
    await screen.findByRole('option', { name: 'Amazon' });
    fireEvent.change(input, { target: { value: 'net' } });
    expect(screen.queryByRole('option', { name: 'Amazon' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Netflix' })).toBeInTheDocument();
  });

  it('marks the active beneficiary via aria-selected', async () => {
    render(<MerchantSearchBar beneficiaryId="1" onChange={() => {}} />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Search merchant' }));
    expect(await screen.findByRole('option', { name: 'Amazon' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
