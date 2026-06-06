# Frontend platform upgrade — summary (v1.0)

> The *what* of the v1.0 frontend platform-upgrade work: scope, the
> contract changes it wired in from the backend platform upgrade
> running in parallel, the patterns it established, and the polish it
> carries into post-deploy. For the chronological *how* — per-batch
> dates, commit SHAs, mid-flight pivots — see [`log.md`](log.md). For
> UAT-round findings + pre-deploy decisions — see
> [`uat-and-pre-deploy.md`](uat-and-pre-deploy.md).

## Goal

Wire every backend platform-upgrade change (BE Phases 1.1 through 2.16)
into the FE while the refactor's feature-based architecture was still
new, and ship a deploy-ready frontend on top. The BE upgrade ran in
parallel — these batches are the FE side of one cross-stack workstream
tracked in `.scratch/task-platform.md`.

Two standing constraints held throughout:

- **The refactor's architecture is the floor.** Every batch landed
  inside the existing feature boundaries (eslint `boundaries` plugin
  enforced) and the existing toolchain gates (zero-warnings lint,
  bundle budgets, vitest). New patterns extended the playbook in
  [`docs/conventions.md`](../../conventions.md) — never re-invented
  it.
- **One BE phase = one named FE batch.** Twenty named batches landed
  on `feat/platform-upgrade`, plus two standalone `docs:` aligns
  posted by Batches 2 and 5 follow-ups. Batch 20 is a squash of 12
  UAT-driven WIPs (see [`log.md`](log.md) for the breakdown).

## Scope — by module

The FE side of each BE platform-upgrade phase landed in a numbered
batch. Module-level current state lives in
[`docs/modules/`](../../modules/).

| Domain | BE phases | FE batches | Outcome |
|---|---|---|---|
| Auth — preferences SoT | 1.9 | Batch 2 | `useAuth` hydrates `user_preferences` on login/register; preferences moved off the profile DTO. |
| Auth — devices + rate-limit | 1.8, 1.4 | Batch 3 | `X-Device-Id` mint + send; `Retry-After` envelope + countdown UX; `<AuthErrorNotice>`. |
| Metadata — timezones BE-sourced | 1.3 | Batch 4 | Retired the `countries-and-timezones` npm dep; `useTimezonesQuery`. |
| Settings cluster | 1.6, 1.10, 1.12, 1.13, 2.1, 2.8 | Batch 5 + Batch 19 | Sessions list / revoke, ProfileImagePicker + presets, DataExportPanel, EmailChangeForm two-step flow, DangerZone + CancelDeletionPage, ResetZone (data-reset). |
| Admin — role enum gate | 1.11 + 2.16 | Batch 6 + Batch 18 | `useAdminGateQuery`, `/admin` scaffold, full operator portal (users / detail / bill backfill / cemetery / signal-settings catalog tunables). |
| Insights / dashboard cluster | 1.7, 2.4 | Batch 7 | Group-by-tag + budget-status field renames, `<ExpenseTrendChart>`, dashboard activity widget (later retired in Batch 18). |
| Taxation — 5-state bill machine | 2.6 | Batch 8 + Batch 20 UAT | Mark-paid / mark-unpaid, adjustments split, `auto_enabled` toggle. Batch 20 pivoted the current-week tracker to FE-derive from the ACCRUING bill (BE endpoint never shipped). |
| Auth — 2FA TOTP | 2.7 + 3.0 follow-on | Batch 9 + Batch 20 UAT | `<TwoFactorSection>`, `/verify/2fa` polymorphic login response, `useSecurityStatusQuery` for the auth-domain snapshot. Batch 20 threaded `enroll_token` after the BE moved enrollment staging from DB to JWT. |
| Auth — new-device OTP | 2.3 | Batch 10 | `<TrustedDeviceList>`, `/verify/new-device` flow, `RevokeDevicePage` public landing. |
| Recurring | 1.5 + 2.x | Batch 11 | `/recurring` inference page; dashboard `<UpcomingBillsWidget>`. |
| Statement upload — async | 2.2 | Batch 12 + Batch 20 UAT | 4-step sync pipeline retired; async-job page + Dock + ParserPicker. Batch 20 added the `<StatementProgressRing>`, brand `<ParserIcon>`, auto-redirect on submit, and the post-COMPLETED downstream-cache invalidation sweep (incl. delayed recurring). |
| Bank accounts | 1.x (carve-out) | Batch 13 | Settings CRUD, identifier sub-resource, tax-pot nudge, manual-txn picker. |
| BE Phase 2.9-2.11 wireup | 2.9–2.11 | Batch 16 | `/api/v1/*` prefix + "Aevum" rebrand consumed from `/metadata/branding`. |
| Theme — accent tokens | (Batch-internal) | Batch 17 | `@theme inline` block in `src/index.css` (teal in light, indigo in dark); semantic `success/warning/danger` tokens (theme-stable). |
| Activity feed — v2 + admin | 2.14, 2.16 | Batch 18 + Batch 20 UAT | Registry-driven engine + per-user signal-settings + admin catalog tunables. Batch 20 added the in-place `<ActivityDetailModal>` + per-subject CTAs + unseen-count badge polish. |
| Data reset + auth.security split | 2.15 + 3.0 | Batch 19 | `<ResetZone>` + `useSecurityStatusQuery` (auth-domain snapshot OFF `/me`). |

## Patterns established

Beyond the refactor's existing playbook, the platform-upgrade added
four cross-cutting patterns that future batches should reach for first:

1. **Profile / auth domain split.** Auth-protection state
   (`two_factor_enabled`, `has_recovery`, `backup_codes_remaining`)
   lives on `GET /api/v1/auth/security` — never on `/me`. Mirrors
   the BE's screaming-architecture split. See
   [`docs/modules/auth.md`](../../modules/auth.md) §api/security.ts.
2. **Polymorphic login response.** `POST /auth/login` (and
   `reset-password-final`) returns one of three shapes: tokens,
   `two_factor_required + pending_token`, or
   `new_device_verification_required + pending_token + masked_email`.
   `isTwoFactorChallenge` / `isNewDeviceChallenge` discriminate;
   `useAuth.login()` chains through `/verify/*` pages without
   opening a session until tokens land.
3. **Modal-first CRUD.** Add/Edit/Delete sub-flows on list pages
   live as URL-state-synced modals (`useModal({ urlKey: 'add' })`);
   legacy routes (`/add-transaction`, `/transactions/:id/edit`)
   redirect to the modal URL. See
   [`docs/conventions.md`](../../conventions.md) §DetailModal +
   the per-feature sections of
   [`docs/modules/transactions.md`](../../modules/transactions.md).
4. **Idle-time prefetch** (Batch 20). Click-gated chunks that gate
   first paint behind a lazy boundary warm via
   `prefetchOnIdle(fn, delayMs)` after the user lands —
   staggered 2–8 s in `app/idlePrefetchSchedule.ts` (most-clicked
   first). Trades a slightly hotter idle window for zero click
   latency on the common navigation paths. See
   [`docs/conventions.md`](../../conventions.md) §Idle-time
   prefetch.

## Bundle posture

Headroom held under the existing 125 kB / 15 kB budgets across all
twenty batches; the biggest single win was Batch 19's `<TopNavMenus>`
lazy-chunk extraction (~9 kB initial JS), with Batch 20's idle-
prefetch sweep keeping the latency invariant. Final at `a963f87`:

| Surface | Size (gzipped) | Budget | Headroom |
|---|---|---|---|
| Initial JS | **111.63 kB** | 125 kB | 13.37 kB (89 % of cap) |
| Initial CSS | **12.64 kB** | 15 kB | 2.36 kB (84 % of cap) |

Full per-batch numbers + notes in
[`docs/performance.md`](../../performance.md) "Post-refactor —
Platform FE Batches 1-4" onwards.

## Open polish carried into post-deploy

- QR rendering on the 2FA enrollment flow.
- Wire `npm run size` into CI as a hard gate (currently local-only).
- DRY the four `VITE_API_URL ?? 'http://localhost:4000'` fallback
  sites to a single `shared/api/baseUrl.ts`.
- Lighthouse audit pass + scores recorded in
  [`docs/performance.md`](../../performance.md).
- Playwright E2E build-out (draft at `e2e/e2e_implementation_plan.md`).
