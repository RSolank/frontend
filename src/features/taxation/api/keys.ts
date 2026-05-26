// React-query keys for the taxation feature. Two root namespaces under
// `taxation`: `rules` (covers the /api/taxation-rules endpoint set) and
// `bills` (covers /api/consumption-tax/*). Mutations invalidate
// `taxationKeys.all` so any cached subtree refreshes after a save.
//
// The trackerWeek / trackerSummary keys cover the Tax Tracker enhancement
// surfaces (current-week running tax + per-category + projection). They
// point at scaffold endpoints the backend will fill in — see
// docs/refactor/backend-handoff/tax-tracker.md for the API contract.
export const taxationKeys = {
  all: ['taxation'] as const,

  rules: () => [...taxationKeys.all, 'rules'] as const,
  rulesList: () => [...taxationKeys.rules(), 'list'] as const,

  bills: () => [...taxationKeys.all, 'bills'] as const,
  billsList: () => [...taxationKeys.bills(), 'list'] as const,
  billDetail: (billId: number) =>
    [...taxationKeys.bills(), 'detail', billId] as const,

  tracker: () => [...taxationKeys.all, 'tracker'] as const,
  trackerCurrentWeek: () => [...taxationKeys.tracker(), 'current-week'] as const,
} as const;
