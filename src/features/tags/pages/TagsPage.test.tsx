import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../../test/baseUrl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { server } from '../../../test/server';

import { TagsPage } from './TagsPage';

const tagsResponse = {
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

const constants = {
  SYSTEM_USER_ID: 0,
  TOTAL_TAG_ID: 1,
  MISCELLANEOUS_TAG_ID: 2,
  MISC_CREDIT_TAG_ID: 4,
  CONSUMPTION_TAX_TAG_ID: 3,
};

beforeEach(() => {
  server.use(
    http.get(`${API_BASE}/tags`, () => HttpResponse.json(tagsResponse)),
    http.get(`${API_BASE}/metadata/constants`, () =>
      HttpResponse.json(constants)
    )
  );
});

describe('TagsPage', () => {
  it('renders tag list after loading', async () => {
    renderWithProviders(<TagsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading tags...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('Restaurants')).toBeInTheDocument();
    // (system) badge dropped per the 2026-05-27 design lock — system
    // context now surfaces only via the Update button's tooltip + the
    // disabled fields inside the edit modal.
    expect(screen.queryByText('(system)')).not.toBeInTheDocument();
  });

  it('submits a new tag with aliases and reloads the list', async () => {
    const postSpy = vi.fn();
    server.use(
      http.post(`${API_BASE}/tags`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        postSpy(body);
        return HttpResponse.json({ tag: { tag_id: 99 } });
      })
    );

    renderWithProviders(<TagsPage />);

    await waitFor(() =>
      expect(screen.queryByText('Loading tags...')).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }));

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Subscriptions/i), {
      target: { value: 'Transport' },
    });

    fireEvent.change(screen.getByPlaceholderText(/Enter alias/i), {
      target: { value: 'Bus' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create tag' }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tag_name: 'Transport',
          aliases: ['Bus'],
          parent: null,
          tag_type: 'discretionary',
        })
      );
    });
  });
});
