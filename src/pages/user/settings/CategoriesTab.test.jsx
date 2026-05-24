import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { apiFetch } from '../../../utils/apiClient';

import { CategoriesTab } from './CategoriesTab';

vi.mock('../../../utils/apiClient.js', () => ({
  apiFetch: vi.fn(),
}));

const mockTagsResponse = {
  tags: [
    {
      tag_id: 10,
      tag_name: 'Groceries',
      parent: null,
      tag_type: 'essential',
      aliases: [],
      created_by: null,
      children: [],
    },
    {
      tag_id: 11,
      tag_name: 'Dining',
      parent: null,
      tag_type: 'discretionary',
      aliases: ['Restaurants'],
      created_by: 1,
      children: [],
    },
  ],
};

const mockConstants = {
  SYSTEM_USER_ID: 0,
  TOTAL_TAG_ID: 1,
  MISCELLANEOUS_TAG_ID: 2,
  CONSUMPTION_TAX_TAG_ID: 3,
};

describe('CategoriesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders tag list after loading', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/api/tags') return mockTagsResponse;
      if (url === '/api/metadata/constants') return mockConstants;
      return {};
    });

    render(<CategoriesTab />);

    expect(screen.getByText('Loading tags...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading tags...')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Groceries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dining').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Restaurants')).toBeInTheDocument();
    expect(screen.getByText('(system)')).toBeInTheDocument();
  });

  it('submits a new tag with aliases and reloads the list', async () => {
    apiFetch.mockImplementation(async (url, options) => {
      if (url === '/api/tags' && !options) return mockTagsResponse;
      if (url === '/api/metadata/constants') return mockConstants;
      if (url === '/api/tags' && options?.method === 'POST')
        return { tag: { tag_id: 99 } };
      return {};
    });

    render(<CategoriesTab />);

    await waitFor(() => {
      expect(screen.queryByText('Loading tags...')).not.toBeInTheDocument();
    });

    // Click Add Tag to show form
    fireEvent.click(screen.getByText('Add Tag'));

    fireEvent.change(screen.getByPlaceholderText(/e.g. Subscriptions/i), {
      target: { value: 'Transport' },
    });

    // Add alias using chip UI
    const aliasInput = screen.getByPlaceholderText(/Enter alias/i);
    fireEvent.change(aliasInput, { target: { value: 'Bus' } });
    fireEvent.click(screen.getByText('Add'));

    fireEvent.click(screen.getByText('Create Tag'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/tags',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"tag_name":"Transport"'),
        })
      );
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/tags',
        expect.objectContaining({
          body: expect.stringContaining('"aliases":["Bus"]'),
        })
      );
    });
  });
});
