// Cross-feature navigation contract for "mutate a categorization rule from
// another flow". A feature (e.g. transactions) saves its own entity, then
// navigates to the categorization rules page with this state; the rules page
// reads it, opens its editor pre-filled, and (for the create case) backfills
// the originating record's rule link after the rule is saved.
//
// This lives in shared/ and is plain data — it carries NO feature import, so
// the transactions↔categorization boundary stays intact (navigation is a
// router string + serialisable state, not a cross-feature dependency).

export const CATEGORIZATION_RULES_PATH = '/settings/categorization-rules';

export interface RulePrefillState {
  mode: 'create' | 'edit';
  beneficiaryId: number;
  beneficiaryName: string;
  // Tags to pre-fill the editor with (the originating flow's chosen tags).
  tagIds: number[];
  // Edit mode: the rule being updated.
  ruleId?: number;
  // Create mode: the transaction whose rule_id should be backfilled once the
  // new rule exists (re-stamped via the transactions PATCH route).
  originatingTxnId?: number;
}

// Type guard for the opaque `location.state`.
export function readRulePrefill(state: unknown): RulePrefillState | null {
  if (!state || typeof state !== 'object') return null;
  const candidate = (state as { rulePrefill?: unknown }).rulePrefill;
  if (!candidate || typeof candidate !== 'object') return null;
  const c = candidate as Partial<RulePrefillState>;
  if (c.mode !== 'create' && c.mode !== 'edit') return null;
  if (typeof c.beneficiaryId !== 'number' || !Array.isArray(c.tagIds)) {
    return null;
  }
  return candidate as RulePrefillState;
}
