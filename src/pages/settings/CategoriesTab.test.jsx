import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { CategoriesTab } from './CategoriesTab';
import { apiFetch } from '../../utils/apiClient';

vi.mock('../../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockTagsResponse = {
  tags: [
    {
      tag_id: 2, tag_name: 'Groceries', parent: null, tag_type: 'essential',
      aliases: [], created_by: null, children: []
    },
    {
      tag_id: 3, tag_name: 'Dining', parent: null, tag_type: 'discretionary',
      aliases: ['Restaurants'], created_by: 1, children: []
    }
  ]
};

describe('CategoriesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders tag list after loading', async () => {
    apiFetch.mockResolvedValueOnce(mockTagsResponse);

    render(<CategoriesTab />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Tag names appear both in the list and the parent <select>; assert at least one occurrence
    expect(screen.getAllByText('Groceries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dining').length).toBeGreaterThanOrEqual(1);
    // System tags show (system) label
    expect(screen.getByText('(system)')).toBeInTheDocument();
    // Aliases are displayed
    expect(screen.getByText(/Aliases: Restaurants/)).toBeInTheDocument();
  });

  it('submits a new tag and reloads the list', async () => {
    apiFetch.mockResolvedValueOnce(mockTagsResponse); // initial load
    apiFetch.mockResolvedValueOnce({ tag: { tag_id: 99, tag_name: 'Transport', tag_type: 'essential' } }); // POST
    apiFetch.mockResolvedValueOnce(mockTagsResponse); // reload

    render(<CategoriesTab />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/e.g. Subscriptions/i), {
      target: { value: 'Transport' }
    });
    fireEvent.change(screen.getByLabelText(/Tag Type/i), { target: { value: 'essential' } });

    fireEvent.submit(screen.getByText('Add tag').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/tags', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"tag_name":"Transport"')
      }));
    });
  });

  it('does not submit if tag name is empty', async () => {
    apiFetch.mockResolvedValueOnce(mockTagsResponse);

    render(<CategoriesTab />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Submit without filling the name
    fireEvent.submit(screen.getByText('Add tag').closest('form'));

    // POST should NOT have been called
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1); // only the initial load
    });
  });
});
