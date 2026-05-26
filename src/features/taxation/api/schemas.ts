import { z } from 'zod';

// PUT /api/taxation-rules/:txn_type body shape. Both rates are stored
// server-side as fractions (0.05 = 5%), but the form input is a fraction
// string for parity with the legacy surface; humanization (×100 display
// with a % suffix) happens in the rate-edit dialog before save.
export const taxationRuleFormSchema = z.object({
  tax_rate: z
    .number({ message: 'Tax rate must be a number' })
    .min(0, 'Tax rate must be ≥ 0')
    .max(10, 'Tax rate must be ≤ 10 (i.e. 1000%) — usually a fraction like 0.05'),
  default_penalty_rate: z
    .number({ message: 'Default penalty rate must be a number' })
    .min(0, 'Default penalty rate must be ≥ 0')
    .max(10, 'Default penalty rate must be ≤ 10'),
});

export type TaxationRuleFormInput = z.infer<typeof taxationRuleFormSchema>;

// POST /api/consumption-tax/bills/generate body shape. period_start and
// period_end are `YYYY-MM-DD` (interpreted in user tz upstream).
export const billGenerateSchema = z
  .object({
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  })
  .refine((b) => b.period_start <= b.period_end, {
    message: 'period_start must be on or before period_end',
    path: ['period_end'],
  });

export type BillGenerateInput = z.infer<typeof billGenerateSchema>;
