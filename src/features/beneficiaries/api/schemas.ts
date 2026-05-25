import { z } from 'zod';

import type {
  Beneficiary,
  BeneficiaryType,
  MerchantDetail,
  PersonDetail,
} from './queries';

// Form-shape for the create / detail page. Merchant + person fields
// coexist on the form so a type switch can carry shared values across
// (phone↔contact, upi_id↔upi_id).
export const beneficiaryFormSchema = z.object({
  uid: z.number().nullable().default(null),
  name: z.string().trim().min(1, 'Name is required'),
  aliases: z.array(z.string().trim().min(1)).default([]),
  beneficiary_type: z.enum(['merchant', 'person']).default('merchant'),
  category: z.string().optional().default(''),
  contact: z.string().optional().default(''),
  merchant_upi_id: z.string().optional().default(''),
  relationship_type: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  person_upi_id: z.string().optional().default(''),
});
export type BeneficiaryFormInput = z.infer<typeof beneficiaryFormSchema>;

export interface BeneficiaryPayload {
  name: string;
  aliases: string[];
  beneficiary_type: BeneficiaryType;
  merchant?: MerchantDetail;
  person?: PersonDetail;
}

export interface MergePayload {
  source_uid: number;
  target_uid: number;
}

export function emptyBeneficiaryForm(
  type: BeneficiaryType = 'merchant'
): BeneficiaryFormInput {
  return {
    uid: null,
    name: '',
    aliases: [],
    beneficiary_type: type,
    category: '',
    contact: '',
    merchant_upi_id: '',
    relationship_type: '',
    phone: '',
    person_upi_id: '',
  };
}

export function beneficiaryToForm(b: Beneficiary): BeneficiaryFormInput {
  return {
    uid: b.uid,
    name: b.name || '',
    aliases: [...(b.aliases || [])],
    beneficiary_type: b.beneficiary_type || 'merchant',
    category: b.merchant?.category || '',
    contact: b.merchant?.contact || '',
    merchant_upi_id: b.merchant?.upi_id || '',
    relationship_type: b.person?.relationship_type || '',
    phone: b.person?.phone || '',
    person_upi_id: b.person?.upi_id || '',
  };
}

// Cross-type carry-over: when a merchant flips to a person, propagate
// `contact` → `phone` and the merchant upi to the person upi (and vice
// versa) so the user doesn't lose data they just typed.
export function switchBeneficiaryType(
  form: BeneficiaryFormInput,
  nextType: BeneficiaryType
): BeneficiaryFormInput {
  if (!form || form.beneficiary_type === nextType) return form;

  if (nextType === 'merchant') {
    return {
      ...form,
      beneficiary_type: 'merchant',
      contact: form.contact || form.phone || '',
      merchant_upi_id: form.merchant_upi_id || form.person_upi_id || '',
    };
  }
  return {
    ...form,
    beneficiary_type: 'person',
    phone: form.phone || form.contact || '',
    person_upi_id: form.person_upi_id || form.merchant_upi_id || '',
  };
}

export function formToPayload(form: BeneficiaryFormInput): BeneficiaryPayload {
  const payload: BeneficiaryPayload = {
    name: form.name.trim(),
    aliases: form.aliases,
    beneficiary_type: form.beneficiary_type,
  };
  if (form.beneficiary_type === 'merchant') {
    payload.merchant = {
      category: form.category ? String(form.category).trim() || null : null,
      contact: form.contact.trim() || null,
      upi_id: form.merchant_upi_id.trim() || null,
    };
  } else {
    payload.person = {
      relationship_type: form.relationship_type.trim() || null,
      phone: form.phone.trim() || null,
      upi_id: form.person_upi_id.trim() || null,
    };
  }
  return payload;
}
