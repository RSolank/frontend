// BE Phase 1.1 (`1bc5454`) — bank accounts + account identifiers.
//
// Account types: the user-selectable set is `REGULAR | SAVINGS |
// OTHER` today; `INVESTMENT | LOAN | CREDIT_CARD` are reserved for
// the future financial-planning module (Decision 27) and rejected
// by the BE create/patch routes, so the FE only surfaces the
// user-selectable three.
//
// Identifier types: only `UPI` ships today. The wire shape is
// future-proof for IFSC / masked-card / statement-ref additions
// — the FE renders the type as a chip pill but doesn't expose a
// type picker until a second value lands.

export type UserAccountType = 'REGULAR' | 'SAVINGS' | 'OTHER';

export const USER_ACCOUNT_TYPES: readonly UserAccountType[] = [
  'REGULAR',
  'SAVINGS',
  'OTHER',
] as const;

export const ACCOUNT_TYPE_LABEL: Record<UserAccountType, string> = {
  REGULAR: 'Regular',
  SAVINGS: 'Savings',
  OTHER: 'Other',
};

export type AccountIdentifierType = 'UPI';

export const ACCOUNT_IDENTIFIER_TYPES: readonly AccountIdentifierType[] = [
  'UPI',
] as const;

export interface AccountIdentifier {
  uid: number;
  identifier: string;
  identifier_type: AccountIdentifierType;
}

export interface BankAccount {
  uid: number;
  label: string;
  account_type: UserAccountType;
  is_committee_account: boolean;
  archived_at: string | null;
  identifiers: AccountIdentifier[];
  created_at: string;
}

// POST body. `identifiers` may be passed inline at create-time so
// the user can register an account + its first UPI handle in one
// round-trip — the typical case for the statement-upload "register
// this account" deep-link.
export interface BankAccountCreatePayload {
  label: string;
  account_type: UserAccountType;
  is_committee_account?: boolean;
  identifiers?: AccountIdentifierCreatePayload[];
}

export interface BankAccountUpdatePayload {
  label?: string;
  account_type?: UserAccountType;
  is_committee_account?: boolean;
}

export interface AccountIdentifierCreatePayload {
  identifier: string;
  identifier_type: AccountIdentifierType;
}

// FE form shape — pre-payload. All strings so it composes with
// react-hook-form / <input> directly. Identifiers are managed as a
// `pending` list during create; in edit-mode they go through the
// dedicated POST/DELETE identifier endpoints (no PATCH today).
export interface BankAccountFormInput {
  label: string;
  account_type: UserAccountType;
  is_committee_account: boolean;
  // Pending identifiers in create-mode; ignored in edit-mode
  // (edit uses the live identifier sub-resource endpoints).
  pendingIdentifiers: AccountIdentifierCreatePayload[];
}

export function emptyBankAccountForm(
  seedIdentifier?: string
): BankAccountFormInput {
  return {
    label: '',
    account_type: 'REGULAR',
    is_committee_account: false,
    pendingIdentifiers: seedIdentifier
      ? [{ identifier: seedIdentifier, identifier_type: 'UPI' }]
      : [],
  };
}

export function bankAccountToForm(
  account: BankAccount
): BankAccountFormInput {
  return {
    label: account.label,
    account_type: account.account_type,
    is_committee_account: account.is_committee_account,
    pendingIdentifiers: [],
  };
}

export function formToCreatePayload(
  form: BankAccountFormInput
): BankAccountCreatePayload | null {
  const label = form.label.trim();
  if (!label) return null;
  return {
    label,
    account_type: form.account_type,
    is_committee_account: form.is_committee_account,
    ...(form.pendingIdentifiers.length > 0
      ? { identifiers: form.pendingIdentifiers }
      : {}),
  };
}

export function formToUpdatePayload(
  form: BankAccountFormInput,
  original: BankAccount
): BankAccountUpdatePayload | null {
  const label = form.label.trim();
  if (!label) return null;
  const patch: BankAccountUpdatePayload = {};
  if (label !== original.label) patch.label = label;
  if (form.account_type !== original.account_type)
    patch.account_type = form.account_type;
  if (form.is_committee_account !== original.is_committee_account)
    patch.is_committee_account = form.is_committee_account;
  return Object.keys(patch).length > 0 ? patch : null;
}
