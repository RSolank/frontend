import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { TagPayload } from './schemas';

export interface CreatedTag {
  tag_id: number;
  tag_name?: string;
  tag_type?: string;
  parent?: number | null;
}

export interface CreateTagResponse {
  tag: CreatedTag;
}

export function createTagRequest(
  payload: TagPayload
): Promise<CreateTagResponse> {
  return apiFetch<CreateTagResponse>(routes.tags.create(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTagRequest(
  tagId: number,
  payload: TagPayload
): Promise<unknown> {
  return apiFetch<unknown>(routes.tags.byId(tagId), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteTagRequest(tagId: number): Promise<unknown> {
  return apiFetch<unknown>(routes.tags.byId(tagId), { method: 'DELETE' });
}
