# Bank Accounts feature

> Owns the user's bank accounts + their identifiers (UPI handles
> today; IFSC + masked-card land later). Drives the
> `/settings/bank-accounts` page, exposes the optional picker on
> manual transaction forms, and ships the dismissible tax-pot
> nudge. Mirrors `backend/app/modules/bank_accounts/`. Lives at
> [`src/features/bankAccounts/`](../../src/features/bankAccounts/).

## Purpose

- Render `/settings/bank-accounts` as a CRUD list — add / edit /
  delete user bank accounts and manage their identifiers
  (UPI handles).
- Surface the `is_committee_account` flag (the tax-pot
  designation, single per user, BE-enforced) and the dismissible
  banner that nudges new users to set one.
- Expose an optional `<BankAccountField>` on the manual
  Add / Edit transaction forms.
- Close the loop with statement-upload — the placeholder
  "register this account?" banner from Batch 12 becomes an
  actionable deep-link CTA (`/settings/bank-accounts?register=<id>`).

The taxation engine works fine with **zero** bank accounts
(Decision 27) — the feature is strictly opt-in.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/settings/bank-accounts` | `pages/BankAccountsPage.tsx` | Lazy-loaded via the settings shell. Consumes `?register=<identifier>` to pre-fill the Add modal. |

Routes are registered inside
[`features/settings/settings.routes.tsx`](../../src/features/settings/settings.routes.tsx)
alongside the other `/settings/*` children. The settings sidebar
entry sits last in `SETTINGS_SECTIONS`.

## Components

| File | Purpose |
|---|---|
| `pages/BankAccountsPage.tsx` | List + add/edit dialog + delete confirm. Mounts the tax-pot nudge. Reads `?register=<identifier>` once on mount to open the Add modal pre-seeded with a pending UPI identifier. |
| `components/BankAccountRow.tsx` | One compact card per account — Wallet icon + label + type pill + tax-pot badge + identifier chip rail + `⋯` trigger. Indigo ring on save (useRowHighlight). |
| `components/BankAccountFormDialog.tsx` | Shared add/edit modal. `useBankAccountForm` view-model owns dirty + Save + only-dirty PATCH. Form body split into `BankAccountFormBody` + `CommitteeCheckbox` + `IdentifiersFieldset` to keep the dialog under the 200-line ceiling. Trash header (Remove-in-edit convention). |
| `components/IdentifierChips.tsx` | Chip rail — one row per identifier with `UPI` pill + monospace value + `×` remove button. Renders persisted (edit mode — × fires DELETE) and pending (create mode — × splices local state) identifiers through the same single path. |
| `components/TaxPotNudge.tsx` | Dismissible amber banner. Shown when (a) the user hasn't dismissed AND (b) no account is flagged `is_committee_account`. Reads `useBankAccountsQuery` from inside so the parent doesn't pay the query cost up-front. |
| `components/BankAccountPicker.tsx` | Bare `<select>` primitive. `null` = "No account". Tax-pot row gets a ` · Tax-pot` suffix. |
| `components/BankAccountField.tsx` | Self-contained form field (label + picker + optional helper). Hides the entire field when the user has no accounts so manual-txn forms don't render an orphan label. |

## State

- **`features/bankAccounts/state/taxPotNudge.store.ts`** — Zustand
  + `persist` middleware (`pba.tax-pot-nudge`); single `dismissed`
  flag. Surface-agnostic — once dismissed, all current and future
  nudge surfaces hide.
- **Server state** — React Query under `bankAccountKeys.{all,
  list, detail(id)}`. Mutations invalidate `bankAccountKeys.all`
  so the list page, the txn pickers, and the tax-pot nudge
  refresh in lockstep. `useBankAccountsQuery` has `staleTime:
  60_000` — list rarely changes mid-session and explicit
  invalidation handles freshness.

## API

[`api/`](../../src/features/bankAccounts/api/)

| File | Exports |
|---|---|
| `keys.ts` | `bankAccountKeys` (`all`, `list()`, `detail(uid)`) |
| `schemas.ts` | `UserAccountType` (`REGULAR \| SAVINGS \| OTHER`), `USER_ACCOUNT_TYPES`, `ACCOUNT_TYPE_LABEL`, `AccountIdentifierType` (`'UPI'`), `ACCOUNT_IDENTIFIER_TYPES`, `BankAccount`, `AccountIdentifier`, `BankAccountCreatePayload`, `BankAccountUpdatePayload`, `AccountIdentifierCreatePayload`, `BankAccountFormInput`, `emptyBankAccountForm`, `bankAccountToForm`, `formToCreatePayload`, `formToUpdatePayload` |
| `queries.ts` | `fetchBankAccounts`, `useBankAccountsQuery(enabled?)` |
| `mutations.ts` | `createBankAccountRequest`, `updateBankAccountRequest`, `deleteBankAccountRequest`, `addAccountIdentifierRequest`, `deleteAccountIdentifierRequest` |

## Endpoints touched

| Method + path | Used by |
|---|---|
| `GET /api/bank-accounts/` | BankAccountsPage list + BankAccountField picker + TaxPotNudge |
| `POST /api/bank-accounts/` | Add modal (Create) |
| `PATCH /api/bank-accounts/{uid}` | Edit modal (Save) |
| `DELETE /api/bank-accounts/{uid}` | Edit modal (Trash → ConfirmDialog) |
| `POST /api/bank-accounts/{uid}/identifiers` | IdentifiersFieldset add (edit mode) |
| `DELETE /api/bank-accounts/{uid}/identifiers/{identifier_uid}` | IdentifiersFieldset × (edit mode) |

## Vocabularies

| Field | Values | Notes |
|---|---|---|
| `account_type` (user-selectable) | `REGULAR \| SAVINGS \| OTHER` | `INVESTMENT \| LOAN \| CREDIT_CARD` are reserved BE-side for the future financial-planning module and rejected on POST/PATCH. |
| `identifier_type` | `'UPI'` only | IFSC + masked-card + statement-ref land later (Decisions 27 / 36). FE renders the type as a chip pill but doesn't yet expose a type picker on the add input. |
| `is_committee_account` | bool | Single-committee-per-user invariant enforced BE-side. PATCHing one account to `true` auto-demotes the prior committee account; the FE invalidates the list query so the demotion is reflected. |

## Statement-upload upgrade path

The Batch 12 `RegisterAccountNotice` (UploadStatementPage +
StatementUploadDock) used to render a passive "Account
registration is coming soon" placeholder when the BE marked
`suggest_register_account=true` on a COMPLETE upload job.
Batch 13 turns it into an actionable CTA:

- The notice + dock both render a "Register this account →" link
  pointing at `/settings/bank-accounts?register=<encoded
  identifier>`.
- `BankAccountsPage` consumes the `?register=` query param on
  mount and opens the Add modal pre-filled with one pending UPI
  identifier (the `detected_identifier` the BE surfaced from the
  upload).
- The param is consumed once and cleared from the URL so a
  refresh doesn't re-open the modal.

## Open BE handoff (Batch 13)

Two open items the FE shipped ahead of (graceful-no-op until
they land):

1. **`bank_account_id` on transaction schemas.** Today the column
   exists on `transactions` (consumed by statement-upload
   auto-attribution) but is NOT exposed on `TransactionCreate /
   TransactionUpdate / TransactionResponse`. The FE sends it in
   POST/PATCH bodies; FastAPI drops unknown fields silently.
   **Effect today:** Add picker's selection is silently dropped;
   Edit picker can't pre-load the saved value (helper text spells
   out the gap). Once BE adds the field, both pickers light up
   automatically — no FE coordination commit needed.
2. **`POST /{uid}/archive`** (optional, low-priority). BE has
   `archived_at` on the response model but no route sets it
   today; DELETE is a hard delete. FE uses hard "Delete" with
   confirm + a warning that statement-upload identifier matches
   stop working. Adding a soft-archive route would let the FE
   offer "Archive" alongside "Delete" later; tracked as a
   nice-to-have, not blocking.

## Tests

| File | Coverage |
|---|---|
| `pages/BankAccountsPage.test.tsx` | Empty state; list rendering with tax-pot badge + identifier chips; Add button opens modal in pristine state with Save disabled; `?register=<identifier>` deep-link opens modal with pending UPI; row `⋯` opens edit modal pre-filled. |
| `components/TaxPotNudge.test.tsx` | Banner renders when no committee account exists; hides when one does; dismiss button persists the flag. |
| `components/BankAccountField.test.tsx` | Hides entirely when the user has no accounts; renders with tax-pot suffix on committee row; onChange fires with numeric uid. |
