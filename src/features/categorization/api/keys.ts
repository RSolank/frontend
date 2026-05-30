// React-query keys for the categorization feature. `rules.list()` keys
// the /api/categorization-rules response; mutations invalidate
// `categorizationKeys.all` so any cached subtree refreshes.
export const categorizationKeys = {
  all: ['categorization'] as const,
  rules: () => [...categorizationKeys.all, 'rules'] as const,
  rulesList: () => [...categorizationKeys.rules(), 'list'] as const,
} as const;
