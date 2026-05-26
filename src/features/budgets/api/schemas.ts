import { z } from 'zod';

// POST /api/budget-limits body shape — see backend
// `budget_schemas.BudgetLimitUpsert`. The frontend tracks the rate
// as a fraction (0.05 = 5%) for parity with the taxation surface;
// the form input is humanized via the same `5%` / `0.05` parser
// used in features/taxation/components/TaxationRuleFormDialog.
export const budgetFormSchema = z.object({
  tag_id: z.number().int().positive(),
  budget_period: z.literal('monthly').default('monthly'),
  limit_amt: z
    .number({ message: 'Monthly limit must be a number' })
    .min(0, 'Monthly limit must be ≥ 0'),
  penalty_rate: z
    .number({ message: 'Penalty rate must be a number' })
    .min(0, 'Penalty rate must be ≥ 0')
    .max(10, 'Penalty rate must be ≤ 10 (i.e. 1000%)'),
});

export type BudgetFormInput = z.infer<typeof budgetFormSchema>;
