import { z } from 'zod';

import { validatePassword } from '../../../shared/utils/validation';

// Form / payload schemas for the auth feature. Server-shape schemas
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

export const loginSchema = z.object({
  email_id: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Form shape (what RHF tracks). `contact_local` + `dialCode` are UI-only;
// `register()` composes them into the server-shape `contact` field.
export const registerFormSchema = z.object({
  email_id: z.email('Enter a valid email'),
  password: passwordSchema,
  security_question: z.string().optional().default(''),
  security_answer: z.string().optional().default(''),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  dob: z.string().optional().default(''),
  dialCode: z.string().optional().default('+91'),
  contact_local: z.string().optional().default(''),
  country: z.string().optional().default(''),
  currency: z.string().optional().default(''),
  timezone: z.string().min(1, 'Timezone is required'),
});
export type RegisterFormInput = z.infer<typeof registerFormSchema>;

// Server-shape payload (matches RegisterRequest plus the queued-for-
// follow-up `timezone` field). Built in handleSubmit from the form input.
export interface RegisterPayload {
  email_id: string;
  password: string;
  security_question: string | null;
  security_answer: string | null;
  first_name: string;
  last_name: string;
  dob: string | null;
  contact: string | null;
  country: string | null;
  currency: string;
  timezone: string;
}

export const recoveryEmailSchema = z.object({
  email_id: z.email('Enter a valid email'),
});

export const recoveryAnswerSchema = z.object({
  email_id: z.email(),
  answer: z.string().min(1, 'Answer is required'),
});

export const recoveryOtpSchema = z.object({
  email_id: z.email(),
  otp: z
    .string()
    .min(6, 'OTP must be 6 digits')
    .max(6, 'OTP must be 6 digits'),
});

export const recoveryResetSchema = z.object({
  reset_token: z.string(),
  new_password: passwordSchema,
});
