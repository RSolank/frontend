// Canonical display labels for the activity `domain` axis.
//
// Every activity signal carries a `domain` (see the backend
// `activity_registry` SignalSpec.domain). The backend emits the raw axis
// only — labels for enum/taxonomy axes are owned by the FE (the BE labels
// reference data alone, via the `metadata` module). This is the single
// source for the domain labels so the bell feed and the signal-settings
// editor can never drift.
//
// Keys are the 7 domains emitted by the registry's `_sig(...)` table:
//   account · bank_accounts · beneficiaries · budgets · recurring ·
//   taxation · transactions
// A consumer shipped a domain not listed here (e.g. a new BE domain ahead
// of the FE) should fall back to a title-cased form — see
// `shared/utils/activityDomain.domainLabel`.
export const ACTIVITY_DOMAIN_LABELS: Record<string, string> = {
  taxation: 'Taxation',
  budgets: 'Budgets',
  recurring: 'Recurring',
  account: 'Account',
  beneficiaries: 'Beneficiaries',
  bank_accounts: 'Bank Accounts',
  transactions: 'Transactions',
};
