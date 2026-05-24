import { z } from 'zod';

import { validatePassword } from '../../../shared/utils/validation';

// Form / payload schemas for the users feature. Server-shape interfaces
// mirror the OpenAPI types in src/shared/types/api.ts; form-shape
// schemas carry UI-only fields (e.g. dialCode + contact_local).

const passwordSchema = z.string().superRefine((val, ctx) => {
  const result = validatePassword(val);
  if (!result.isValid) {
    ctx.addIssue({
      code: 'custom',
      message: 'Password does not meet requirements',
    });
  }
});

export const profileFormSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  dob: z.string().optional().default(''),
  email_id: z.string().optional().default(''),
  dialCode: z.string().optional().default('+91'),
  contact_local: z.string().optional().default(''),
  country: z.string().optional().default(''),
  currency: z.string().optional().default(''),
  timezone: z.string().min(1, 'Timezone is required'),
});
export type ProfileFormInput = z.infer<typeof profileFormSchema>;

// Server-shape PATCH payload for /api/users/me.
export interface ProfileUpdatePayload {
  first_name: string;
  last_name: string;
  dob: string | null;
  contact: string | null;
  country: string | null;
  currency: string | null;
  timezone: string;
}

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const setRecoveryQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
});
export type SetRecoveryQuestionInput = z.infer<
  typeof setRecoveryQuestionSchema
>;
