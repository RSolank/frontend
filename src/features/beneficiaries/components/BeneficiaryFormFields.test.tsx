import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTags } from '../../tags/api/queries';
import { fetchCategorizationRules, fetchRelationships } from '../api/queries';
import {
  emptyBeneficiaryForm,
  type BeneficiaryFormInput,
} from '../api/schemas';

import { BeneficiaryFormFields } from './BeneficiaryFormFields';

// Behaviour coverage added in Batch 10.11 round-2, alongside the split of
// the type-specific field groups into MerchantFields / PersonFields and the
// chip row into AssignedTagChips. No colocated test existed. Reference-data
// fetches are mocked so the merchant/person branches render deterministically.
vi.mock('../../tags/api/queries', () => ({ fetchTags: vi.fn() }));
vi.mock('../api/queries', () => ({
  fetchRelationships: vi.fn(),
  fetchCategorizationRules: vi.fn(),
}));
vi.mock('../api/mutations', () => ({
  deleteCategorizationRule: vi.fn(),
  updateCategorizationRuleTags: vi.fn(),
}));

const mockTags = vi.mocked(fetchTags);
const mockRelationships = vi.mocked(fetchRelationships);
const mockRules = vi.mocked(fetchCategorizationRules);

// Controlled harness — BeneficiaryFormFields is a controlled component, so a
// parent holds the form state and feeds setForm back in.
function Harness({ initialType }: { initialType: 'merchant' | 'person' }) {
  const [form, setForm] = useState<BeneficiaryFormInput>(() =>
    emptyBeneficiaryForm(initialType)
  );
  return <BeneficiaryFormFields form={form} setForm={setForm} />;
}

describe('BeneficiaryFormFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTags.mockResolvedValue({
      tags: [
        { tag_id: 1, tag_name: 'Total', parent: null, children: [] },
        { tag_id: 5, tag_name: 'Groceries', parent: null, children: [] },
      ],
    } as never);
    mockRelationships.mockResolvedValue(['friend', 'family'] as never);
    mockRules.mockResolvedValue({ rules: [] } as never);
  });

  it('renders merchant fields and hides system-only tags from the category list', async () => {
    render(<Harness initialType="merchant" />);
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Contact (phone or website)')
    ).toBeInTheDocument();
    // The category picker is a SearchableSelect — options only render
    // once the combobox gains focus. Wait for the tags fetch to land
    // first, then open the dropdown to inspect the option list.
    await waitFor(() => expect(mockTags).toHaveBeenCalled());
    fireEvent.focus(screen.getByRole('combobox', { name: 'Category' }));
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'Groceries' })
      ).toBeInTheDocument()
    );
    // tag_id 1 (Total) is system-only and must not be offered.
    expect(
      screen.queryByRole('option', { name: 'Total' })
    ).not.toBeInTheDocument();
  });

  it('selecting a category surfaces it as an assigned-tag chip', async () => {
    render(<Harness initialType="merchant" />);
    await waitFor(() => expect(mockTags).toHaveBeenCalled());
    fireEvent.focus(screen.getByRole('combobox', { name: 'Category' }));
    const groceries = await screen.findByRole('option', { name: 'Groceries' });
    fireEvent.mouseDown(groceries);
    expect(screen.getByText('Assigned Tags')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove tag Groceries' })
    ).toBeInTheDocument();
  });

  it('renders person fields with the loaded relationship options + category picker', async () => {
    render(<Harness initialType="person" />);
    expect(screen.getByLabelText('Relationship')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    // Categorization-v2: persons now carry a category picker too (full parity
    // with merchants — a person can be a landlord → Rent, etc.).
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'friend' })).toBeInTheDocument()
    );
  });
});
