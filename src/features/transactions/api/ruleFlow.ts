import type { CategorizationRule } from '../../beneficiaries/api/queries';

// Shared helpers for the transaction-entry categorization-rule flow (Add +
// Edit pages). A beneficiary has at most one categorization rule, so a
// transaction's tags either match that rule (rule-derived), diverge from it (a
// per-transaction override), or there's no rule at all (offer to create one).

export function findRuleForBeneficiary(
  rules: CategorizationRule[],
  beneficiaryId: number | string
): CategorizationRule | undefined {
  if (!beneficiaryId) return undefined;
  const id = Number(beneficiaryId);
  if (Number.isNaN(id)) return undefined;
  return rules.find((r) => r.beneficiary_id === id);
}

// Order-independent set equality — the tag pickers don't preserve order, so a
// reorder must not read as "tags changed".
export function sameTagSet(
  a: readonly number[],
  b: readonly number[]
): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}
