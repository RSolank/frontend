// React-query keys for the tags feature. `tagKeys.list()` keys the
// /api/tags response (the full tag tree). Mutations invalidate
// `tagKeys.all` so any cached subtree refreshes.
export const tagKeys = {
  all: ['tags'] as const,
  list: () => [...tagKeys.all, 'list'] as const,
} as const;
