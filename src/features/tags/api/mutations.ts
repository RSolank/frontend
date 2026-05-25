import { apiFetch } from '../../../shared/api/apiClient';

import type { TagPayload } from './schemas';

export function createTagRequest(payload: TagPayload): Promise<unknown> {
  return apiFetch<unknown>('/api/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTagRequest(
  tagId: number,
  payload: TagPayload
): Promise<unknown> {
  return apiFetch<unknown>(`/api/tags/${tagId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteTagRequest(tagId: number): Promise<unknown> {
  return apiFetch<unknown>(`/api/tags/${tagId}`, { method: 'DELETE' });
}
