# Frontend platform upgrade — log (v1.0)

> The *how* of the v1.0 frontend platform-upgrade work: chronological
> per-batch record of every named commit on `feat/platform-upgrade`.
> For the durable *what* — scope, patterns established, polish carried
> forward — see [`summary.md`](summary.md). For UAT findings +
> pre-deploy decisions — see [`uat-and-pre-deploy.md`](uat-and-pre-deploy.md).

## Timeline

The upgrade ran **2026-05-31 → 2026-06-06** on the frontend submodule,
in parallel with the BE platform upgrade tracked in
`.scratch/task-platform.md` and `.scratch/task-platform-progress.md`.
Each batch is its own commit on `feat/platform-upgrade` (cut from
`dbf28b0`, the FE-refactor v1.0 merge tip on `main`).

## Per-batch entries

Listed in landing order. SHAs reference the FE submodule. Each row's
"BE phases consumed" column links the FE batch to the upstream BE
platform-upgrade phases it wired in.

| # | SHA | Title | BE phases consumed |
|---|---|---|---|
| Batch 1 | `d99ff14` | FE wiring cleanup post-BE Phase 1.3 / 1.15 / 2.6 | 1.3 (metadata.timezones), 1.15 (users.me-stats), 2.6 (taxation engine) |
| Batch 2 | `b4bf9dc` | `users.preferences` server SoT | 1.9 (users.preferences) |
| docs | `cc57419` | docs: align preferences contract docs with Platform FE Batch 2 | — |
| Batch 3 | `90c12f1` | `auth.devices` X-Device-Id + `auth.rate-limit` Retry-After UX | 1.4 (auth.devices), 1.8 (auth.rate-limit) |
| Batch 4 | `74d14a4` | `metadata.timezones` backend-sourced | 1.3 |
| Batch 5 | `35ddbca` | Settings cluster — sessions / profile-image / delete-account / email-change / data-export | 1.6, 1.10, 1.12, 1.13, 2.1, 2.8 |
| docs | `80d0916` | docs: align account/auth/performance docs with Platform FE Batch 5 | — |
| Batch 6 | `023c125` | `admin.role-enum` gate + portal scaffold | 1.11 (role enum + Identity) |
| Batch 7 | `251a704` | Insights/dashboard cluster — activity feed + group-by-tag/budget-status net-expense rename + 6-month trend chart | 1.7 (aggregates engine), 2.4 (activity feed v1) |
| Batch 8 | `1149420` | `taxation.bill-state-machine` — 5-state machine + mark-paid/mark-unpaid + adjustments + `auto_enabled` toggle | 2.6 |
| Batch 9 | `e4004e3` | `auth.2fa-totp` — TOTP enrollment + login-verify + polymorphic login response | 2.7 (T-2fa-enroll) |
| Batch 10 | `6b40154` | `auth.new-device-otp` — OTP entry + revoke landing + trusted-device list + verify→2FA chain | 2.3 (T-new-device-otp) |
| Batch 11 | `17e20a4` | `recurring.templates` — inference-first `/recurring` page + dashboard 7d upcoming widget | 1.5 (recurring engine) |
| Batch 12 | `e6c6fe1` | `statement-upload.async` — async-job page + parser-selector flow + dock + retire legacy 4-step pipeline | 2.2 (T-statement-upload-async) |
| Batch 13 | `096d9e2` | `bank-accounts.crud` — settings CRUD + identifier sub-resource + tax-pot nudge + manual-txn picker + statement-upload upgrade | bank-accounts carve-out |
| Batch 14 | `5d70fa9` | Doc audit fix-forward + API_BASE extraction | — |
| Batch 15 | `86d26a1` | Convention-adherence audit + fix-forward | — |
| Batch 16 | `c21454b` | BE Phase 2.9-2.11 wireup (v1 prefix + Aevum brand) | 2.9–2.11 (api-v1-prefix + rebrand) |
| Batch 17 | `a76b6f0` | Theme-aware accent + semantic color tokens | — |
| Batch 18 | `bb900e1` | T-admin operator portal + activity-feed refresh | 2.14 (activity engine v2), 2.16 (admin operator layer) |
| Batch 19 | `1ac3f9d` | data-reset + auth.security-status + budgets.created_at + TopNav lazy + doc sweep | 2.15 (T-data-reset), 3.0 (auth.security-status) |
| **Batch 20** | **`a963f87`** | **UAT pre-deploy fixes** (12 WIPs squashed — see below) | 9c00ecd (BE txn group_by all-time), 2.7 follow-on (2FA enroll_token stateless staging), statement-upload BE recurring-engine on COMPLETED |

## Batch 20 — squash detail

Batch 20 is the squash of twelve UAT-driven WIP commits accumulated
on `feat/platform-upgrade` after Batch 19 landed. Themes, grouped:

1. **Brand identity** (`fe1bdc4`) — consume the live app name +
   tagline + meta-description from `/metadata/branding` instead of
   hardcoded literals. Closes the BE Phase 2.11 rebrand on the FE
   side.
2. **Notifications-flow rebuild** (`0791964`) — unseen-count badge,
   in-place `<ActivityDetailModal>` (replaces full-page nav), per-
   subject CTA wiring via `shared/utils/activitySubject.ts`.
3. **BE-contract sync** (`a89cf94`) — four downstream drifts: profile-
   image presets list shape, `/auth/sessions` list shape, statement-
   upload status enum (`PROCESSING/COMPLETED/FAILED` + `JobStage`
   union), TopNav settings menu missing Bank Accounts, avatar
   staleness fix (`syncMe()` after profile-pic mutations re-primes
   the auth store + `/me` query cache).
4. **Statement-upload UX overhaul** (`bf1b9be`, `508efa1`) — auto-
   redirect to `/dashboard` on submit, `<StatementProgressRing>`
   (8-stage circular progress), `<ParserIcon>` brand icons via
   simpleicons.org CDN, post-COMPLETED downstream cache invalidation
   (transactions/taxation/dashboard immediate; recurring delayed 5 s).
5. **Idle-prefetch sweep** (`aca6817`) — `prefetchOnIdle` helper +
   `useIdlePrefetch` hook + the 19-entry `AUTHED_PREFETCH` schedule
   in `app/idlePrefetchSchedule.ts`. Stagger 2–8 s, most-clicked
   first. Anonymous schedule warms `AuthModal` after 2 s.
6. **2FA enroll_token** (`b6675df`) — BE moved 2FA enrollment staging
   from DB to JWT (encrypted secret in the token); FE threads the
   token through the QR-scan flow state and posts
   `{enroll_token, code}` to `/2fa/verify-enroll`.
7. **Tax-tracker FE-derive** (`2be7b2c`) — pivoted the current-week
   tracker from a never-shipped BE endpoint (`/tracker/current-week`
   was scoped in Phase 2.6 planning but the phase shipped only bill
   routes) to client-side derivation from the ACCRUING bill. The
   engine's incremental real-time ledger already exposes every datum
   the card needs.
8. **Spending-trend chart sizing** (`a8b7039`, `5f8035e`, `b935beb`)
   — three-step iteration on the expense-tracker trend chart's
   width/height; final viewBox 900×240 (3.75:1) matched to ~3.7:1
   rendered aspect at `max-w-6xl × h-72`.
9. **Transactions group_by all-time** (`b3abfee`) — wired BE `9c00ecd`:
   grouped reads default to all-time when no `month`/`period`/`date`
   is given. Scope pill on the merchant view header surfaces the
   active window ("All time" / "Feb 2026" / "Feb 9 → Feb 15").
   `npm run gen:api` regenerated `shared/types/api.ts` for the new
   `GroupedTransactionsResponse` envelope.

WIP messages were preserved as the body of the Batch 20 commit so
the individual themes remain greppable in `git log`.

## Coordination docs (frozen at deploy)

These `.scratch/` docs were the cross-stack coordination point during
the upgrade. They freeze at deploy and migrate to the BE archive at
its own deploy (the BE side runs the same archive pattern):

- `.scratch/task-platform.md` — sub-phase tracker (status pair per
  item).
- `.scratch/task-platform-progress.md` — long-form rationale + per-
  sub-phase history.
- `.scratch/task-admin.md` + `task-admin-progress.md` — the admin-
  tooling follow-on workstream (Batches 6 + 18).
- `.scratch/platform-upgrade-v1.0/historical-content-audit.md` —
  what content migrates from scratch → live docs (BE side).
- `.scratch/platform-upgrade-v1.0/frontend-deploy-checklist.md` —
  the live FE pre-deploy tracker (this run).
- `.scratch/dashboard-review-followup.md` — the per-card activity-
  enrichment session that drove Batch 7 + Batch 18 design choices.
