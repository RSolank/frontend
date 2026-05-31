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

// Server-shape PATCH payload for /api/users/me. Every field is optional
// because the Account surface ships split pages that each PATCH only
// their own slice — Profile sends name/dob/contact, Preferences sends
// country (currency + timezone moved to `/api/users/preferences` after
// BE Phase 1.9). The backend's PATCH handler accepts a partial body.
export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  dob?: string | null;
  contact?: string | null;
  country?: string | null;
}

// Server-shape PATCH payload for /api/users/preferences. After BE
// Phase 1.9 this is the SoT for every cross-device user preference;
// the row is partial-update friendly so a slice send is fine —
// `subscribeToPreferenceStores()` always PATCHes a single field at a
// time when a store changes.
export interface PreferencesUpdatePayload {
  currency?: string | null;
  timezone?: string;
  date_format?: string;
  number_format?: string;
  landing_route?: string;
  default_txn_kind?: string;
  underline_links?: boolean;
  focus_ring_always?: boolean;
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
