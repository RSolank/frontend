import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { CategorizationRulesTab } from './CategorizationRulesTab';
import { apiFetch } from '../../utils/apiClient';

// Mock apiFetch
vi.mock('../../utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('CategorizationRulesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockRules = {
    rules: [
      {
        uid: 1,
        rule_name: 'Test Rule',
        rule_condition: { field: 'merchant', match: 'icontains', pattern: 'TestShop' },
        rule_implement: { tag_id: 12 },
        notes: 'A test rule',
        created_by: 1
      },
      {
        uid: 2,
        rule_name: 'System Rule',
        rule_condition: { field: 'notes', match: 'equals', pattern: 'Refund' },
        rule_implement: { tag_id: 15 },
        notes: null,
        created_by: null // System rule
      }
    ]
  };

  const mockTags = {
    tags: [
      { tag_id: 12, tag_name: 'Groceries' },
      { tag_id: 15, tag_name: 'Refunds' }
    ]
  };

  it('renders correctly and loads rules and tags', async () => {
    apiFetch.mockImplementation((url) => {
      if (url === '/api/categorization-rules') return Promise.resolve(mockRules);
      if (url === '/api/tags') return Promise.resolve(mockTags);
      return Promise.reject(new Error('not found'));
    });

    render(<CategorizationRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Rule')).toBeInTheDocument();
    });

    expect(screen.getByText('System Rule')).toBeInTheDocument();
    expect(screen.getByText(/Pattern:.*TestShop/)).toBeInTheDocument();
  });

  it('submits a new rule correctly', async () => {
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/categorization-rules' && !options) return Promise.resolve({ rules: [] });
      if (url === '/api/tags') return Promise.resolve(mockTags);
      if (url === '/api/categorization-rules' && options?.method === 'POST') {
        return Promise.resolve({ rule: { uid: 3 } });
      }
      return Promise.resolve({});
    });

    render(<CategorizationRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument(); // Tag options loaded
    });

    // Fill form
    fireEvent.change(screen.getByLabelText(/Rule name/i), { target: { value: 'New Test Rule' } });
    fireEvent.change(screen.getByLabelText(/Pattern/i), { target: { value: 'Shop' } });
    fireEvent.change(screen.getByLabelText(/Tag to apply/i), { target: { value: '12' } });

    // Submit
    fireEvent.submit(screen.getByText('Add rule').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/categorization-rules', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('New Test Rule')
      }));
    });
  });

  it('allows editing an existing rule', async () => {
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/categorization-rules' && !options) return Promise.resolve(mockRules);
      if (url === '/api/tags') return Promise.resolve(mockTags);
      if (url.includes('/api/categorization-rules/1') && options?.method === 'PUT') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    render(<CategorizationRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Rule')).toBeInTheDocument();
    });

    // Click edit on the first rule
    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[0]);

    // Form populates
    expect(screen.getByLabelText(/Rule name/i).value).toBe('Test Rule');

    // Change and save
    fireEvent.change(screen.getByLabelText(/Pattern/i), { target: { value: 'UpdatedShop' } });
    fireEvent.submit(screen.getByText('Update rule').closest('form'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/categorization-rules/1', expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('UpdatedShop')
      }));
    });
  });

  it('allows deleting a rule, but not system rules', async () => {
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/categorization-rules' && !options) return Promise.resolve(mockRules);
      if (url === '/api/tags') return Promise.resolve(mockTags);
      if (options?.method === 'DELETE') return Promise.resolve({});
      return Promise.resolve({});
    });

    // Mock confirm to always return true
    window.confirm = vi.fn().mockImplementation(() => true);

    render(<CategorizationRulesTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Rule')).toBeInTheDocument();
    });

    // Test Rule has a delete button, System Rule does not
    const deleteBtns = screen.getAllByText('Delete');
    expect(deleteBtns.length).toBe(1); // Because System Rule doesn't have it

    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/categorization-rules/1', expect.objectContaining({
        method: 'DELETE'
      }));
    });
    
    window.confirm.mockRestore();
  });
});
