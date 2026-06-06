# Frontend platform upgrade — UAT findings + pre-deploy decisions (v1.0)

> The *third doc* of the v1.0 platform-upgrade archive set: design
> decisions made during the UAT round and during the pre-deploy
> checklist that aren't durable conventions (those went to
> [`docs/conventions.md`](../../conventions.md)) and aren't per-batch
> change history (that's in [`log.md`](log.md)). This is the record
> of "we considered X, picked Y, because Z".
>
> Companion to [`summary.md`](summary.md) + [`log.md`](log.md). Pulls
> FE-relevant decisions from `.scratch/task-platform.md`,
> `task-platform-progress.md`, `task-admin*`, `dashboard-review-followup.md`,
> and the pre-deploy checklist at
> `.scratch/platform-upgrade-v1.0/frontend-deploy-checklist.md`.

## UAT findings + how each was resolved

The UAT round (2026-06-04 → 2026-06-06) walked the deployed shape one
surface at a time. Twelve substantive findings landed as
WIPs on `feat/platform-upgrade` and were squashed into Batch 20.

| Surface | Finding | Resolution | Decision rationale |
|---|---|---|---|
| Account → Profile | "Choose preset" link inert on the profile-image picker | List-shape drift on `/profile-image-presets` (BE returned bare list, FE expected object) | Patched `fetchProfileImagePresets` to handle both shapes; preferred BE-bare shape going forward. |
| Account → Profile | TopNav avatar didn't refresh after pic change | `invalidateQueries(['users','me'])` left a one-render staleness gap because the auth store also caches the URL | New `syncMe()` helper: re-`fetch /me` → write to auth store → `setQueryData` on `userKeys.me()` in one atomic step. |
| Account → Security | Active Sessions empty despite logged-in user | Same list-shape drift on `/auth/sessions` | Patched `fetchSessions`. Generalization: every list-or-object BE shape is exhaustively typed in `shared/types/api.ts` going forward. |
| TopNav settings menu | Bank Accounts missing despite the route working | `SETTINGS_LINKS` array was stale post-Batch-13 | Added the entry. Lesson: when adding a settings-shell sub-page, also update `SETTINGS_LINKS`. |
| Statement upload | Worker showed "in flight" after BE COMPLETED | `JobStatus` enum drift — BE was sending `COMPLETED` but FE compared against `COMPLETE` | Rewrote the enum to match BE: `PROCESSING/COMPLETED/FAILED` + a new `JobStage` union for the 8-state progress ring. |
| Statement upload | Submit → blank wait on the upload page; user wants to do other things | Page held the user even though BE returns `202 + job_id` and the Dock surfaces in-flight state | Auto-redirect to `/dashboard` on submit; Dock force-prefetched on `UploadStatementPage` mount so it's visible the instant the navigation completes. |
| Statement upload | No visual feedback on parse progress | One-state spinner | `<StatementProgressRing>` driven by the 8-state `JobStage`. SVG circle, no extra deps. |
| Statement upload | Parser list looked generic for UPI apps | No icons | `<ParserIcon>` maps PhonePe / Paytm / GPay registry keys to simpleicons.org CDN URLs (CC0). Generic CSV falls through to a neutral file glyph. No bundled assets. |
| Statement upload | Recurring engine didn't run on bulk import | BE shipped reuse-of-service on the same `job_id` post-parse, FE wasn't invalidating recurring keys | FE-only fix: dock fires `transactions/taxation/dashboard` invalidations immediately on COMPLETED, plus a 5 s-delayed `recurring + upcoming-bills` invalidation to catch the BE's slower-path work. No new BE stage; no new poll. |
| Tax Tracker | "This week's running tax" stuck on Loading… with no data | The standalone `/tracker/current-week` endpoint was scoped in BE Phase 2.6 planning but **never shipped** | **Pivoted to FE-derive** from the ACCRUING bill via `deriveTrackerFromBill(bill)` over `useBillsQuery + useBillQuery(activeAccruingBillId)`. Three terminal states cleanly distinguished: loading / error / no-accrual. No BE work needed; tracker card / bill list / bill detail dialog all share the same query cache for the active bill. |
| Expense Tracker | Spending trend bars looked condensed | Chart viewBox aspect didn't match rendered aspect | Three iterations to land on viewBox 900×240 (3.75:1) at `max-w-6xl × h-72`. User clarified twice (don't change page width / restore original width) — final state matches the first-attempt page width, only chart height bumped. |
| Transactions (group_by) | Merchant view empty for backdated imports | BE Phase 2.x grouped read silently scoped to current month when no `month`/`period`/`date` filter | BE `9c00ecd` flipped the default to all-time; FE wired the new `period_type` + `period_start` envelope into a scope pill on the merchant header. Empty-state copy now scope-aware. |

## FE-only design decisions (not in any BE-side decision log)

These calls were made FE-side during the upgrade and don't appear in
any BE phase record. Captured here so future-us can find the
"why" without re-deriving.

1. **Idle-prefetch schedule lives in `app/`, not `shared/`.** The
   eslint `boundaries` plugin blocks `shared/ → features/`; the
   schedule needs to dynamic-import feature pages. `app/` composes
   both layers and is the only valid home. The helper
   (`prefetchOnIdle`) stays in `shared/utils/` because it's
   feature-agnostic.

2. **Idle-prefetch sequencing prioritises TopNav menus.** Observed
   click-latency on the menu cluster was the biggest UAT complaint.
   The schedule's top entry is `TopNavMenus` at 2 s; everything else
   follows. The full schedule reflects "what's the user most likely
   to click in the first 30 s of an authed session" rather than
   alphabetical or chunk-size order.

3. **Tax-tracker FE-derive over waiting for the BE endpoint.** The
   alternative — backlogging the BE — would have blocked deploy. The
   engine already exposes every datum the card needs via the ACCRUING
   bill, and three downstream readers (tracker / list / detail) share
   the same query cache, so the cost is one extra `useBillQuery` call
   only when the tracker card mounts.

4. **Statement-upload recurring invalidation strategy: FE-only.**
   The BE chose to reuse the recurring-engine service on the same
   `job_id` post-parse rather than adding a new pipeline stage with
   its own poll. The FE-only counterpart is a delayed (5 s)
   invalidation of recurring / upcoming-bills query keys on COMPLETED
   — gives the BE service time to finish before re-querying. No
   contract addition; if the BE ever does ship a stage, the delay
   becomes redundant but harmless.

5. **2FA enroll_token threaded through flow state, not query
   cache.** The token is short-lived and single-use; storing it in
   React Query would be needless surface area. Flow state
   (`enrollFlow.data.enroll_token`) is the right scope.

6. **`<ActivityDetailModal>` is in-place expansion, not navigation.**
   Earlier prototype used `navigate(deepLinkUrl)` on row click.
   Pivoted to an in-place modal so users stay in the feed context;
   the per-subject CTA inside the modal is the actual deep-link
   trigger. Hard-ack still fires on the row click so the BE's UNSEEN
   set updates correctly.

## Pre-deploy chore decisions

Captured from the pre-deploy checklist (`.scratch/platform-upgrade-v1.0/frontend-deploy-checklist.md`).

| Decision | Choice | Why |
|---|---|---|
| Source maps in prod build | **Off** (Vite default) | No symbolicator wired (no Sentry equivalent today); revisit when one lands. |
| `VITE_API_URL` trailing-slash rule | **Document**, don't enforce in code | Two-line README + CONTRIBUTING note. Enforcement code adds runtime cost for an env-config footgun that's caught the moment a request fires. |
| `public/mockServiceWorker.js` in prod build | **Keep** | Per memory `msw-service-worker-known-bug`: file stays as a static asset; `src/main.tsx` does not register the worker; the public file is unused at runtime. Kill-switch (delete the file) documented. |
| Format gate (`npm run format:check`) | **Sweep once at deploy, defer CI hook** | Pre-existing drift on `main` (~227 files) + Batch 1–20 drift made the gate red. Mechanical fix via `prettier --write` is 100 % deterministic; landed as a separate `chore:` commit so the substantive squash review wasn't drowned in 250-file format noise. Adding a husky / CI hook is its own post-deploy task. |
| Outer monorepo submodule bump | **Skip** | Same posture as the FE refactor — user bumps the outer pointer manually at the appropriate moment. Decoupled from the FE deploy. |
| Branding leftovers (`favicon.svg` aria-label, `robots.txt` comment) | **Fix in chore docs commit** | Two-line edits; small enough to fold into the docs/archive chore rather than a third dedicated commit. |
| Merge style into `main` | **`--no-ff` merge commit** | Preserves the Batch 1–22 commits as linear history under a boundary node; `git log --first-parent main` reads as "deploy events". Mirrors how feature branches usually land in this submodule. |
| Tag location | **On the merge commit** | The deploy-ready state is post-prettier-sweep, post-merge. |

## Carved-forward — explicitly NOT done at deploy

| Item | Reason for deferral |
|---|---|
| Playwright E2E build-out | Draft at `e2e/e2e_implementation_plan.md`; out of scope per memory `e2e-testing-deferred`. |
| QR rendering on 2FA enrollment | Would punch the bundle ceiling; current base32 + `otpauth://` is the manual-entry fallback. |
| `.size-limit.json` CI hook | Currently `npm run size` is local-only; CI integration is its own task. |
| `VITE_API_URL` fallback DRY | Four sites duplicate `?? 'http://localhost:4000'`; consolidate to `shared/api/baseUrl.ts` post-deploy. |
| Lighthouse audit pass | Recorded as TODO in [`docs/performance.md`](../../performance.md). |
| Outer monorepo submodule-pointer bump | User handles manually (matches FE-refactor pattern). |
