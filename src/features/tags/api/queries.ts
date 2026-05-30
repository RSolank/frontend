import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { tagKeys } from './keys';

// One node in the hierarchical tree returned by /api/tags. Children are
// recursive; aliases / created_by / tag_type / parent are flat fields on
// each node.
export interface TagNode {
  tag_id: number;
  tag_name: string;
  parent: number | null;
  tag_type: string;
  aliases: string[];
  created_by: number | null;
  children?: TagNode[];
}

export interface TagsResponse {
  tags: TagNode[];
}

// System constants the tags UI needs to decide which rows are read-only.
// Sourced from /api/metadata/constants — the same payload used elsewhere
// for category and rule IDs. Kept as a tag-local query (the constants
// endpoint isn't owned by any one feature; shared/api/referenceData
// covers countries/currencies but not these tag-specific constants).
export interface TagConstants {
  SYSTEM_USER_ID?: number;
  TOTAL_TAG_ID?: number;
  MISCELLANEOUS_TAG_ID?: number;
  CONSUMPTION_TAX_TAG_ID?: number;
  [key: string]: unknown;
}

export function fetchTags(): Promise<TagsResponse> {
  return apiFetch<TagsResponse>(routes.tags.list());
}

export function fetchTagConstants(): Promise<TagConstants> {
  return apiFetch<TagConstants>(routes.metadata.constants());
}

export function useTagsQuery() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: fetchTags,
    // Tags rarely change in normal use — bump well past the global
    // 30s default so the Dashboard's WeekByCategoryStrip (Batch 9.5)
    // + TagSelector / CategorizationRulesPage don't re-fetch on every
    // route change. Every mutation site already invalidates
    // `tagKeys.all`, so manual edits propagate instantly regardless
    // of staleTime.
    staleTime: 5 * 60_000,
  });
}
