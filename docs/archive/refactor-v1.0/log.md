# Frontend feature-architecture refactor — log (v1.0)

> The *how* of the v1.0 frontend refactor: the chronological record of every
> named-batch commit, with dates, commit SHAs, mid-flight pivots, and the
> handoff notes that carried context between sessions. For the durable *what*
> — goal, locked decisions, final shape, conventions, deferred follow-ups —
> see [`summary.md`](summary.md).

## Timeline

The refactor ran **2026-05-24 → 2026-05-31** on the frontend submodule. Each
batch was its own fresh session; planning context lived in `CONTRIBUTING.md`,
the in-repo plan, and per-batch handoff notes appended to a working tracker.
The plan specced 13 batches; the ship landed **28 named-batch commits** plus
a handful of inter-batch polish/hotfix commits, because Batches 9 and 10 each
grew into a reviewable sub-series.

### Workflow that held throughout

- Work happened on `refactor/feature-architecture`, cut from the frozen
  baseline `ead6fa4` ("keep parity with backend Batches 1-7"). Nothing landed
  on submodule `main` until the final merge; the outer monorepo took no
  commits during the refactor.
- Within a batch, WIP commits were local rollback points. At batch close —
  after `npm test` was green — they were soft-reset into **one commit per
  batch** (relaxed for the 9.x and 10.x sub-series), then pushed to the
  review branch.
- Each batch closed with a handoff note (single SHA, commands run, non-obvious
  choices + rationale, anything flagged for review). The same content went
  into the commit body so reviewers saw it without opening the tracker.
- Gates per batch: `npm test` (Vitest), `npx tsc --noEmit`, `npm run lint`,
  `npm run build`; later batches added `npm run size`, coverage, and
  Lighthouse.

---

## 2026-05-24 — Planning + Batch 0

- **`dd57c53` — planning + tooling decisions.** Resolved every open
  `TODO(planning)` in `CONTRIBUTING.md` §10: TypeScript strict
  (migrate-as-you-move), TanStack Query v5 + Zustand (`useAuthStore` replacing
  `AuthContext`), react-hook-form + Zod, Tailwind v4, ESLint flat + Prettier,
  MSW, `createBrowserRouter` + per-feature `RouteObject[]` + `protectedRoutes()`,
  global + per-feature error boundaries, the `size-limit` bundle budget. The
  plan and CONTRIBUTING were local-only scaffolds during planning and were
  published to the repo with this commit so the locked decisions were visible
  on the branch.
- **`be23df2` — Batch 0: tooling baseline.** Landed the full stack from 11
  local WIP steps consolidated into one commit. Notable version pins, recorded
  so later sessions wouldn't re-derive them: ESLint pinned `^9` (ESLint 10 hit
  `ERESOLVE` against `eslint-plugin-import` peers); TypeScript `~5.9`
  (`openapi-typescript` 7.x didn't support TS 6); `@types/react` `^18` (latest
  resolved to v19 and broke `useRef<T>()` / implicit children under React
  18.3). A one-shot `prettier --write` + `eslint --fix` over the existing tree
  landed the style baseline here rather than as drift across later batches.
  First OpenAPI generation committed (`src/shared/types/api.ts`, ~3,100 lines).
  Close: 70/70 tests, `tsc` clean, lint 0 errors / 38 warnings (all
  pre-existing legacy a11y), build green.
- **`8021ab4` — docs: commit-cadence fix.** Corrected the Batch 0 intro that
  had implied step-level commits on the pushed branch; aligned the doc with
  the WIP-then-soft-reset cadence Batch 0 had already followed. Doc-only.

## 2026-05-25 — Batches 1–6 (the feature-migration run)

- **`44f5a3a` — Batch 1: `shared/` + app shell + theme + prefs infra.**
  Reshaped the tree into the `shared/` + `app/` skeleton, landed the
  light/dark/system theme (no-FOUC bootstrap `<script>` reads
  `localStorage["theme"]` before React), and wired the frontend half of the
  backend's user-preferences contract (preference headers on every request).
  **Pivot:** the original Batch 1 (never pushed) landed everything except the
  prefs infra; the user added that requirement post-hoc, and it was recombined
  into one commit. Locked the indigo accent and the thin top-header shell.
- **`2da8860` — Batch 2: `auth` feature + Register tz field + prefs
  hydration.** **Workaround that became a backend follow-up:** the backend
  returns a singular `timezone` per country, not a list, so the timezone field
  bundled `countries-and-timezones` (~30 KB gz) behind
  `shared/utils/countryTimezones.ts` — a one-file swap once the API returns the
  list.
- **`769d32b` — visual polish (pre-Batch 3).** Form controls + indigo chrome +
  authed header nav. Inter-batch polish, kept as its own commit.
- **`3a4505b` — hotfix.** Sanitized user-preference headers against non-ASCII
  values (a non-ASCII currency/country value could produce an invalid header).
- **`b4d4b2b` — style(auth).** Restored button cursor + indigo CTA / link
  styles across the auth surface.
- **`be3e858` — Batch 3: `users` + `metadata` features.**
- **`7cd4864` — Batch 4: `tags` + `beneficiaries`.** The **web-first /
  responsive design contract** was written here (documented reflow tiers per
  feature).
- **`34d48f5` — polish (post-Batch 4).** Header chrome bump + responsive
  contract tiering. Inter-batch polish.
- **`84216fd` — Batch 5: `transactions` + `statement_upload`.**
- **`2eec5a7` — Batch 6: `categorization`.**

## 2026-05-26 — Batch 6.5 + Batch 7 (first mid-flight insertion)

- **`8db2861` — Post-Batch 6.** Add-beneficiary modal + categorization-rule
  grouping. This surfaced the modal-first direction that Batch 6.5 generalized.
- **`94dd179` — Batch 6.5: shell upgrade + modal-first CRUD migration**
  (mid-flight insertion, back-documented into the plan). Upgraded the app shell
  and migrated CRUD sub-flows to the shared `Modal` pattern; `ConfirmDialog`
  replaced `window.confirm()` for destructive actions. This is where the
  modal-first convention became project-wide.
- **`5b299cc` — Batch 7: `taxation` move + Tax Tracker enhancement** (scope
  expanded from a plain move). Bill dates render through
  `features/taxation/api/billPeriod.ts:formatBillDate` (hardcoded
  `dd/mon/yyyy`) — flagged as the single swap point for the future
  `date_format` preference.

## 2026-05-27 — Batch 8 + Batch 8.5 (second insertion)

- **`9048999` — Batch 8: `budgets` / Expense Tracker.**
- **`c050255` — Batch 8.5: Dashboard** (mid-flight insertion).

## 2026-05-28 → 05-29 — Batch 9 expands into a sub-series

The plan had Batch 9 as one "Settings shell + Account surface" entry. Scope
discovered during the work (accessibility stores, conventions, calendar) was
larger than the monolithic entry, so the **9.x dot-numeric sub-numbering
convention** was introduced — each shippable unit its own reviewable commit,
no letter scheme, no renumbering of pushed history.

- **`3f17d83` (05-28) — Batch 9: Settings shell + Account surface + 10
  accessibility stores + sidebar polish.**
- **`9c63442` (05-28) — Batch 9.1: polish + Help + Indian-number grouping.**
- **`02fd7b3` (05-28) — Batch 9.5: ExpenseTracker anomaly badges + Dashboard
  week-by-category.** *(`9.2/9.3/9.4` were a reserved-and-unused gap — a
  window held for any 9.x polish that might surface; none did.)*
- **`2efc4d5` (05-29) — Batch 9.6: Calendar view + filter overhaul.** **Locked
  three project-wide conventions:** ISO Mon–Sun weeks (in the user's
  timezone), the DetailModal pattern, and `SearchableSelect` for large
  data-driven dropdowns.
- **`2d8ed84` (05-29) — Batch 9.8: cross-feature convention enforcement +
  DetailModal seamless transition + folded audits.** Reaffirmed the
  seamless read→edit transition (form always rendered, `readOnly` inputs +
  locked-field banner). *(`9.7`, recurring-transactions UI, was **dropped**
  here to the post-refactor backlog — it gated on backend `T-recurring`, and
  keeping it would have coupled the refactor's critical path to backend
  timing.)*

## 2026-05-30 → 05-31 — Batch 10 expands into a 10.x ship-it series

Batch 10 turned out to be ~12 independent workstreams (deferred audits +
cleanup + a full complexity decomposition). It was restructured into a numbered
`10.x` series via `git cherry-pick` onto `2d8ed84` (`git rebase -i` is blocked
in this environment), mirroring the 9.x precedent. This deliberately superseded
the "one commit per batch" rule for Batch 10; the merge was a single `--no-ff`
of the whole series. A `batch10-wips-backup` branch held the original WIP
commits, verified tree-identical to the cherry-picked series, until confidence
was established.

- **`663fbb6` — 10.1: central API routes registry** (`shared/api/routes.ts`) —
  no inline `/api/...` strings; ships with `const V = '/api'` (the `/api/v1`
  flip is a one-line post-cutover change).
- **`93ff1a5` — 10.2: ESLint on the TS tree + complexity/sonarjs gates**
  (warn-level initially).
- **`7fd2862` — 10.3: user-preferences audit fixes** (`formatCount`,
  `formatYearMonth`).
- **`3a44ec3` — 10.4: coverage wiring (60% floor) + Lighthouse (4×≥90).** CI
  promotion deferred.
- **`ebe9920` — 10.5: docs sweep + README.**
- **`8a240e9` — 10.6: legacy-dir cleanup.** Home/Help → `src/app/pages/`;
  `src/pages` deleted.
- **`6fccb28` — 10.7: feature-boundary groundwork.** `metadata` dissolved into
  `shared/` (`shared/api/referenceData.ts` + `shared/components/{Country,
  Currency,Timezone}Select`); `hydratePreferences` moved to
  `features/users/api/`; `eslint-plugin-boundaries` adopted at warn.
- **`a59a251` — 10.8: safe lint remediation.**
- **`eff4d30` — 10.9: enforce feature boundaries** at **error** with 9
  documented exceptions (settings→pages; transactions/categorization→
  beneficiaries/tags create-dialogs). The public-barrel refinement
  (per-feature `index.ts` + `boundaries/entry-point`) was filed as an optional
  post-merge follow-up.
- **`a9ed076` — 10.10: complexity reductions, low + medium tier.** Established
  `useMoneyFormatter()` (`shared/hooks/`) as THE money-format pattern (applied
  across ~13 files); `cx` extractions; slow-regex and amount-helper fixes; the
  two select widgets. The complexity work followed a locked cadence: one file
  at a time, low→high risk, diagnose → report → user calls fix-or-defer, with
  the test suite as guard for the high-complexity epicenter
  (`TransactionsPage`, complexity 40). `SearchableSelect`/`TimezoneSelect`
  complexity was suppressed with a justified note (inherent widget complexity).
- **`0ef9442` — 10.11: post-refactor follow-ups + lint board to zero.** Drove
  the board to **0 errors / 0 warnings**.
- **`de6e85b` (05-31) — 10.12: enforce maintainability gates + codify
  conventions.** Promoted the sonarjs recommended set + complexity gates from
  warn to **error** at the current thresholds (complexity 15 /
  max-lines-per-function 200 / max-depth 4 / nested-callbacks 4 / max-params 5),
  with a **ratchet rule**: the thresholds are a ceiling that may tighten but
  never loosen, the current state must not degrade, and the board stays at
  0/0 via `eslint --max-warnings 0`. Documented in `CONTRIBUTING.md` §3.

## 2026-05-31 — Merge

- **`31f4cee` — merge.** `git merge --no-ff refactor/feature-architecture`
  with message "Frontend feature-architecture refactor: Batches 0–10", tagged
  **`frontend-v1.0-refactor`**. A manual smoke pass preceded the merge (the
  plan's "closing gate for Batch 9" moved in practice to the merge gate).

### State left at merge

- `main` was pushed by the user (the agent's blanket local authorization
  auto-revoked at the merge). The **tag was not yet pushed to origin**, and the
  **outer-monorepo submodule pointer was deliberately not bumped** — both left
  as the user's call.

## Post-merge documentation cleanup (2026-05-31)

A dedicated cleanup pass ran after the merge to bring the published docs to the
shipped state and migrate the working artifacts into this archive:

- Rewrote `docs/architecture.md` and the 13 module docs to current state
  (current folder tree, corrected toolchain/gate descriptions, removed
  shipped-as-pending items and dead paths from the dissolved `metadata`
  feature).
- Extracted the component/UI patterns into `docs/conventions.md` (the living
  playbook) and slimmed `CONTRIBUTING.md` from ~1,074 to ~480 lines, leaving
  §6 as principles + a pointer; light README polish; reconciled the
  `performance.md` bundle table to the actual 125 KB budget.
- Authored this archive (`summary.md` + `log.md`) from the plan, the
  reconciled planned-vs-shipped ledger, and the per-batch handoff notes, then
  retired the working tracker and the in-repo refactor plan.

## Open items carried past the refactor

Filed during the refactor, intentionally **not** part of it:

- `eslint-plugin-boundaries` public-barrel refinement (replace the 9
  documented exceptions with per-feature `index.ts` + `boundaries/entry-point`).
- Accessibility pass: TopNav mobile-menu backdrop scrim (Escape/focus
  handling), `CalendarView` `role="grid"` keyboard navigation, sub-44px
  tap-target policy.
- Per-glob 80% critical-path coverage + a CI pipeline (size + coverage as
  build-failing gates).
- `/api/v1` prefix flip (one-line `V` change in `routes.ts`), pending the
  backend v1 cutover.
- Nested-ternary style pass for the remaining one-off idiomatic cases left as
  accepted.
- Recurring-transactions UI and the other backend-gated feature commits (bank
  accounts UX, statement-upload UX, bill state-machine UI, 2FA UI) — land as
  post-refactor feature commits once their backend dependencies ship.
- The backend API/schema follow-ups enumerated in [`summary.md`](summary.md).

## Appendix — deferred follow-up: `eslint-plugin-boundaries` v6 migration

Audited near the end of the refactor (with hot context) but **deferred** to a
focused post-refactor exercise; no config was changed. Recorded here so a
future session can execute it confidently rather than re-investigating. This is
distinct from the public-barrel refinement noted above.

**Why it exists.** `eslint-plugin-boundaries@6.0.2` emits three *stderr*
deprecation warnings against the current `eslint.config.js` (not counted lint
problems — the config works correctly as-is): (1) the `boundaries/element-types`
rule name is deprecated in favour of `boundaries/dependencies`; (2) the legacy
tuple-with-captures selector syntax; (3) the legacy `${...}` template syntax in
favour of `{{...}}`. The payoff is purely cosmetic (silence the noise +
future-proof for v7). The risk is asymmetric: a mis-translated selector can
make a rule match *nothing*, so lint goes green because the boundary is
**silently de-enforced**, not because it's satisfied — hence the deferral and
the mandatory probe below.

**Resolved schema** (from the installed type defs): `ElementTypesRule` and
`DependenciesRule` are the *same shape* — only the rule name changed.
Plain-string selectors (`'shared'`, `'app'`, `'feature'`, `'feature-api'`) are
**not** deprecated. The deprecated form is the tuple
`[type, capturesObj]` → replace with an object `{ type, <capture> }`. Legacy
`${...}` templates still work (default-on), but `{{...}}` is the modern form.

**Exact translation of the current config** (the `boundaries/element-types`
block):
- Rename the rule key `boundaries/element-types` → `boundaries/dependencies`.
- `default: 'disallow'` and the `rules: [...]` array structure: unchanged.
- Plain-string selectors stay verbatim.
- Convert ONLY the 4 tuple-with-capture selectors:
  - the feature/feature-api self-allow:
    `['feature', { feature: '${from.feature}' }]` →
    `{ type: 'feature', feature: '{{from.feature}}' }`;
  - the documented-exception `from`s and their cross-feature `allow` entries:
    `['feature', { feature: 'settings' }]` →
    `{ type: 'feature', feature: 'settings' }` (likewise `transactions`,
    `categorization` → `beneficiaries`/`tags`).
- Leave the `boundaries/elements` element descriptors untouched (not
  deprecated).

**Mandatory probe (green lint is NOT sufficient).** After migrating,
temporarily introduce then revert each case, confirming the expected outcome:
`shared/` importing a feature → MUST error; feature A importing feature B's
non-`api/` internals → MUST error; feature → `shared`, feature → another
feature's `api/`, and each documented exception → MUST pass. If any banned
import passes (silent de-enforcement) or any legit import errors (over-strict),
revert and keep it deferred.

**Risk after audit:** LOW — a rule rename plus 4 object-selector conversions,
all backward-compatible, reversible, and probe-verifiable (~15 min with the
probe).
