import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { CategorizationRulesTab } from './CategorizationRulesTab';
import { apiFetch } from '../../../utils/apiClient';

vi.mock('../../../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockRules = {
  rules: [
    {
      uid: 1,
      rule_name: 'Test Rule',
      rule_condition: { field: 'beneficiary', match: 'icontains', pattern: 'TestShop' },
      rule_implement: { tag_ids: [12] },
      notes: 'A test rule',
      created_by: 1
    }
  ]
};

const mockTags = {
  tags: [
    { tag_id: 12, tag_name: 'Groceries', children: [] },
    { tag_id: 15, tag_name: 'Refunds', children: [] }
  ]
};

const mockConstants = {
  SYSTEM_USER_ID: 0,
  TOTAL_TAG_ID: 1,
  MISCELLANEOUS_TAG_ID: 2
};

describe('CategorizationRulesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders correctly and loads data', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/categorization-rules') return mockRules;
      if (url === '/api/tags') return mockTags;
      if (url === '/api/options/constants') return mockConstants;
      return {};
    });

    render(<CategorizationRulesTab />);

    expect(await screen.findByText(/Test Rule/)).toBeInTheDocument();
    expect(await screen.findByText(/TestShop/)).toBeInTheDocument();
    expect(await screen.findByText(/Groceries/)).toBeInTheDocument();
  });

  it('submits a new rule with keywords and tags', async () => {
    apiFetch.mockImplementation(async (url, options) => {
      if (url === '/api/categorization-rules' && !options) return { rules: [] };
      if (url === '/api/tags') return mockTags;
      if (url === '/api/options/constants') return mockConstants;
      if (url === '/api/categorization-rules' && options?.method === 'POST') return { rule: { uid: 3 } };
      return {};
    });

    render(<CategorizationRulesTab />);

    await waitFor(() => expect(screen.getByText('Add Rule')).toBeInTheDocument());
    
    // Toggle form
    fireEvent.click(screen.getByText('Add Rule'));

    fireEvent.change(screen.getByLabelText(/Rule name/i), { target: { value: 'New Test Rule' } });
    
    // Add keyword
    fireEvent.change(screen.getByPlaceholderText(/Enter keyword/i), { target: { value: 'Shop' } });
    fireEvent.click(screen.getAllByText('Add')[0]);
    
    // Add tag
    fireEvent.change(screen.getByDisplayValue(/Select a tag/i), { target: { value: '12' } });
    fireEvent.click(screen.getAllByText('Add')[1]); // Second Add button is for Tags

    // Submit
    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/categorization-rules', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Shop')
      }));
    });
  });
});
