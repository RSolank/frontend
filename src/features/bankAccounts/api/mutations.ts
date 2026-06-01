import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type {
  AccountIdentifier,
  AccountIdentifierCreatePayload,
  BankAccount,
  BankAccountCreatePayload,
  BankAccountUpdatePayload,
} from './schemas';

// POST /api/bank-accounts/ — create. `identifiers` may be inline.
// 409 on duplicate-identifier across the user's accounts.
export function createBankAccountRequest(
  payload: BankAccountCreatePayload
): Promise<BankAccount> {
  return apiFetch<BankAccount>(routes.bankAccounts.root(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// PATCH /api/bank-accounts/{uid} — partial update. Promoting
// `is_committee_account: true` auto-demotes the prior committee
// account (single-committee invariant enforced BE-side); the FE
// invalidates the list query so the demotion is reflected.
export function updateBankAccountRequest(
  uid: number,
  payload: BankAccountUpdatePayload
): Promise<BankAccount> {
  return apiFetch<BankAccount>(routes.bankAccounts.byId(uid), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// DELETE /api/bank-accounts/{uid} — hard delete. Identifiers
// cascade. Historic transactions with `bank_account_id` pointing
// here are NULLed (ondelete=SET NULL on the FK). Statement-upload
// identifier matches against this account stop working — the UI
// warns the user in the confirm dialog before firing this.
export function deleteBankAccountRequest(uid: number): Promise<void> {
  return apiFetch<void>(routes.bankAccounts.byId(uid), {
    method: 'DELETE',
  });
}

// POST /api/bank-accounts/{uid}/identifiers — attach a new
// identifier (UPI handle today). 409 on duplicate across the
// user's accounts.
export function addAccountIdentifierRequest(
  uid: number,
  payload: AccountIdentifierCreatePayload
): Promise<AccountIdentifier> {
  return apiFetch<AccountIdentifier>(routes.bankAccounts.identifiers(uid), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// DELETE /api/bank-accounts/{uid}/identifiers/{identifier_uid} —
// remove an identifier. No PATCH today: editing a UPI handle means
// delete + re-add.
export function deleteAccountIdentifierRequest(
  uid: number,
  identifierUid: number
): Promise<void> {
  return apiFetch<void>(
    routes.bankAccounts.identifierById(uid, identifierUid),
    { method: 'DELETE' }
  );
}
