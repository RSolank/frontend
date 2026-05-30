// Server-shape payload for POST/PUT /api/categorization-rules.
// `name` is generated client-side from beneficiary + tags
// (see ruleUtils.buildRuleName).
export interface CategorizationRulePayload {
  name: string;
  beneficiary_id: number;
  tag_ids: number[];
  notes: string | null;
}
