# Frontend Conventions

> **The component & UI patterns to adopt while building features here.**
> Process, gates, and project structure live in
> [`CONTRIBUTING.md`](../CONTRIBUTING.md); how the app is wired lives in
> [`docs/architecture.md`](architecture.md). This file is the playbook —
> when you build or change a surface, follow the patterns below so every
> feature looks and behaves consistently.

## Contents

- [**Visual design language**](#visual-design-language) — color, spacing, density, dark mode, responsive contract.
- [**Modal pattern**](#modal-pattern-crud-first-surfaces) — the standard surface for create/edit sub-flows.
- [**Searchable list with inline create**](#searchable-list-with-inline-create) — list + typeahead + add-new.
- [**Searchable dropdowns**](#searchable-dropdowns-when-required) — when a typeahead select is required.
- [**DetailModal**](#detailmodal-canonical-view--edit-surface) — the canonical view + edit surface for CRUD features.
- [**Modal-header destructive actions**](#modal-header-destructive-actions-remove-in-edit) — the Remove-in-edit convention.
- [**Row highlight on save**](#row-highlight-on-save) — post-save feedback on the originating list.
- [**Activity callouts**](#activity-callouts-surfacing-feed-items-outside-the-bell) — surfacing feed items outside the TopNav bell.
- [**Idle-time prefetch**](#idle-time-prefetch) — warm click-gated chunks during the browser idle window.
- [**Accessibility vs Preferences**](#accessibility-vs-preferences) — device a11y toggle vs backend-persisted preference.
- [**Motion**](#motion) — framer-motion via the shared `m`/`LazyMotion` foundation, load-first, reduced-motion-honoring.
- [**Week convention**](#week-convention) — ISO Mon→Sun, app-wide.

---

## Visual design language

The app targets a **modern, sleek, premium feel** — reference tier:
Linear / Stripe / Vercel / Notion. Anything you build or touch should
meet that bar, not the plain-CSS / generic-forms baseline the app left
behind.

**Operating principle:** when you build or change a component, style it
in the design language below from the start — don't ship the plain look
and re-skin it later.

**Concrete elements of the target language:**

- **Whitespace and rhythm.** Generous padding; consistent vertical
  spacing scale (Tailwind's `space-y-*` / `gap-*` from a small set of
  values — e.g. 2, 3, 4, 6, 8). No tight, dense layouts unless data
  density is the point (transaction tables can be tight; forms cannot).
- **Type hierarchy.** Clear weight contrast: page titles bold/semibold,
  body regular, supporting text muted. Limit to ~3 sizes per screen.
  Use a system font stack or one well-chosen webfont (Inter / Geist /
  system-ui), set globally — no per-component font surprises.
- **Color discipline.** A restrained neutral palette + one brand
  accent + three semantic state colors. Locked in Platform FE Batch
  17 via a single `@theme inline` block at the top of
  [`src/index.css`](../src/index.css):
  - **`accent-*`** is the brand accent. It is the ONLY token that
    flips per theme: **teal** in light mode, **indigo** in dark
    mode. Every brand surface (CTAs, links, focus rings, active-tab
    indicators, hover affordances) reads from `accent-*` — never
    from `indigo-*` or `teal-*` directly. The flip lives in the
    `:root` / `html.dark` blocks; consumers stay theme-agnostic.
  - **`success-*` / `warning-*` / `danger-*`** are the semantic
    state tokens. They DO NOT flip per theme — the same family
    resolves in both modes (emerald / amber / rose). The per-shade
    selection handles light vs dark contrast at each call site
    (e.g. `text-success-600 dark:text-success-400`).
  - Decorative one-offs (the landing-page gradient end, mock
    category-tint dots) MAY use raw Tailwind colors — they're not
    brand surfaces. Treat anything that conveys "this is
    interactive / on-brand" as brand and tokenize it.
  - No ad-hoc hex values inside components. The CSS-variable
    indirection is what makes the theme flip work at runtime; a
    raw `#xxxxxx` literal can't follow `.dark`.
- **Corners and surfaces.** Small-to-medium rounded corners
  (`rounded-md` / `rounded-lg`); subtle shadows (`shadow-sm` /
  `shadow-md`) for elevated surfaces (cards, modals, dropdowns). No
  harsh borders; if a border is needed, use a low-contrast neutral.
- **Motion.** Smooth transitions on hover/focus/active state changes,
  ~150ms ease-out. `transition-colors`, `transition-shadow`,
  `transition-transform` — never `transition-all`. Reduced-motion users
  (`prefers-reduced-motion`) get instantaneous transitions.
- **Interactive feedback on everything.** Every clickable element has
  hover + focus + active states. Visible focus rings (don't suppress
  `:focus-visible`). Disabled buttons look obviously disabled.
- **Dark mode from day one.** Use Tailwind's `dark:` variant on every
  component as it's built. Don't defer dark-mode to a later pass — it's
  cheap if done as you go, painful retroactively. The theme
  infrastructure and a header `<ThemeToggle />` (light / dark / system)
  are part of the app shell, so dark styling is verifiable as you
  write it.
- **Responsive design from day one** — same posture as dark mode. The
  app is web-first today and a native mobile app is a future track
  (see §1 "Platform target"), but **every batch must make its surfaces
  resize comfortably to phone / tablet browser widths and to narrow
  desktop windows** (split-screen, docked panels). Retrofitting
  responsive later is the trap to avoid; the feature author knows
  best how their layout should degrade.
  - **Breakpoint contract** (Tailwind defaults): `sm` 640 px,
    `md` 768 px, `lg` 1024 px, `xl` 1280 px. Design mobile-first —
    base styles target the narrowest viewport, breakpoints layer on
    desktop niceties.
  - **Touch targets ≥ 44 px** on interactive controls (matches iOS HIG
    / Android 48 dp guidance). Smaller is acceptable on `md+` if a
    larger pointer-friendly equivalent is also reachable.
  - **Tables and data-dense surfaces** must handle narrow viewports:
    horizontal scroll inside the surface OR a card/list fallback at
    `sm` — the owning feature picks what reads better for its data.
    Tables should never force `body` to scroll horizontally.
  - **Header / navigation collapse rules** — non-essential elements
    (e.g. "Hello, _firstname_" greeting, breadcrumbs) get
    `hidden sm:inline` / `hidden md:flex` so the icon row stays
    uncrowded on narrow screens. Don't ship a hamburger pattern until
    a screen genuinely needs it.
  - **Per-surface responsibility** — check every surface you build at
    `sm` (375 px), `md` (768 px), and a desktop width before shipping it.
  - **Effort tiers by surface density.** The _check_ is always per
    batch; the _implementation work_ scales with what the feature
    actually contains:
    - **Form / list / chip surfaces** (auth pages, profile, tags,
      beneficiaries, settings): usually a 5-minute viewport smoke
      test — open at 375 px and desktop, click around, fix anything
      visibly broken. Often nothing needs to change; record the
      check in the handoff and move on.
    - **Table, grid, multi-step, and dense surfaces** (transactions
      list, statement upload, taxation bills, budget grids,
      Dashboard, statement-parse review tables): require deliberate
      responsive design _upfront_ — pick the degradation strategy
      (horizontal-scroll-inside-card, card-stack, column-hide) before
      writing the markup, not after. Tables don't degrade naturally;
      retrofitting is painful.
    - The handoff note should be honest about which tier the
      surface fell into and what (if anything) needed work.
- **Modals over secondary routes for create/edit sub-flows.**
  `shared/components/Modal.tsx` is the **preferred surface** for any
  flow that creates or edits a
  sub-entity from within a parent context — adding a beneficiary
  while filling a categorization rule, editing a budget limit from
  the budgets overview, etc. Reasons: the parent's in-flight form
  state survives the round trip; no cross-window juggling; mobile
  reflows to a bottom-sheet automatically; keyboard-trap-free
  Escape + click-outside close. Consumer pattern: caller component
  owns the open/close state and a typed `onCreated` /
  `onSaved` callback; the dialog wraps the shared form-fields
  component + a Save/Cancel footer.
  - **Auth on the landing page** applies this pattern: `/` (Home)
    exposes Login / Register CTAs that open the shared `<LoginForm>` /
    `<RegisterForm>` in a modal. **`/login` and `/register` remain
    canonical routes alongside the modal entry points** — they're the
    surface for deep links (password-reset emails → "Sign in to
    continue"), browser password-manager detection, SEO/indexing
    controls, and back-button semantics. The modal is an additional
    entry path, not a replacement.
  - **Don't use a modal for primary-content surfaces** (dashboards,
    list views, detail pages). Modals are for _secondary, focused
    actions_ — anything that would also work as "open in a new tab"
    belongs on a route, not in a modal.
- **Loading and empty states** are first-class. Skeletons for any list
  fetch > 200 ms (per §8); thoughtful empty states with a clear next
  action (not just "No data").
- **Accessibility is part of polish**, not a separate concern: visible
  focus, ARIA where semantic HTML doesn't suffice, color contrast
  passing WCAG AA.

**Anti-patterns to avoid:**

- Generic Bootstrap-era blue buttons; flat untreated forms; tables with
  zero whitespace; harsh saturated colors; modals that fill the entire
  viewport on desktop; UI that looks the same in light and dark mode
  because dark mode wasn't considered.

**Pragmatism — don't redesign blindly:** if a screen already works well
visually and just needs to migrate from plain CSS to Tailwind, do exactly
that. Reserve substantial redesign effort for screens that are visibly
weak today (likely candidates: Dashboard, Transactions list, Budget
overview, Taxation bills view).

**When a redesign decision is non-trivial** (e.g. picking the accent
color, choosing between two layout structures for a complex screen),
pause and surface options — this is exactly the kind of taste decision
that benefits from user input rather than autonomous choice.

## Modal pattern (CRUD-first surfaces)

Locked 2026-05-26. **Modal-first CRUD is the
default for content features** (transactions, beneficiaries, tags,
categorization rules, taxation rules, budget limits). Add / edit /
view / delete-confirm flows open as modals over the list page rather
than navigating to a dedicated page. Auth (Login / Register / Recovery)
is **hybrid** — full pages preserved for deep-links and password
manager autofill, modal flow offered from Home as a convenience layer.

**Why modals over pages for CRUD:**

- **Context preservation.** Users see the list behind the modal —
  they don't lose their place.
- **Faster perceived flow.** No route transition; modal open is
  instantaneous, route transitions trigger a re-mount of the list
  and refetch.
- **Mobile-friendly.** A full-viewport modal on narrow viewports
  reads identically to a page; on desktop the side-by-side context
  is a clear win.

**Implementation rules:**

- All modals use `src/shared/components/Modal.tsx` (wraps Radix UI's
  Dialog). Never roll a custom modal — accessibility correctness
  (focus trap, escape-key, ARIA dialog semantics, scroll lock) is too
  error-prone to redo per feature.
- Sizing variants: `sm` (~400 px, confirmation dialogs), `md` (~600 px,
  most CRUD forms), `lg` (~800 px, dense forms or detail views),
  `xl` (~1024 px, statement upload preview). Stick to the four; don't
  invent new sizes.
- **URL-state sync for shareable modals.** Modals that represent a
  primary user intent (add-transaction, edit-budget) sync state to
  the URL via `useModal({ urlKey: 'add' })` so `/transactions?add=true`
  reopens the modal on reload and is shareable. Modals that are
  ephemeral (delete confirmation, error details) don't need URL sync.
- **Forms inside modals use react-hook-form normally** — Zod schema +
  resolver, same pattern as page forms. The form component should be
  extractable: a single `<XyzForm />` mounted in both a page wrapper
  and a modal wrapper (no form-state duplication).
- **Modal close confirmations** when the form is dirty — built into
  `Modal.tsx` via a `confirmOnDirty` prop; never let users lose typed
  input to a stray backdrop click.
- **CTAs live in the `footer` prop, not the body.** Primary/secondary
  action buttons (Save / Cancel / Confirm / Delete / Verify, etc.) go in
  the Modal's `footer` slot, which right-aligns them in a bordered bar —
  `ConfirmDialog` and every form dialog follow this. Order is
  secondary-left → primary-right. For a body `<form>` that needs
  Enter-to-submit, give the form an `id` and point a footer
  `<button type="submit" form="…">` at it (e.g. `TwoFactorSection`'s
  `twofa-enroll-form`, `TagFormDialog`) — you keep Enter-to-submit **and**
  the footer placement. The **only** justified inline-CTA exception is a
  full **page/form component reused both standalone and `embedded` in a
  modal** (`AuthModal` → `LoginForm`/`RegisterForm`; the transactions
  Add/Edit modals → `AddTransactionPage`/`EditTransactionPage`): its CTAs
  belong to the reused component, so the modal wrapper adds none. A
  dialog built only for the modal has no excuse to put CTAs in the body.
- **Must-acknowledge modals** (one-time reveals the user can't safely
  dismiss, e.g. 2FA backup codes) set `dismissible={false}` — hides the
  close X and blocks Escape / overlay-click; closes only via an explicit
  footer action wired to `onClose`.

**When NOT to use a modal:**

- **Auth flows on first visit** — full pages are friendlier to
  password managers and screen readers (hybrid auth keeps both).
- **Multi-step wizards** beyond ~3 steps — promote to a page with
  step indicators.
- **Long-form editing** where the user needs persistent navigation
  (rare in this app).

## Searchable list with inline create

Locked 2026-05-26. **When a form field
asks the user to pick from a list AND the user can extend that list,
the picker uses the SearchableList pattern.** Use it for beneficiary
pickers, tag pickers, categorization-rule beneficiary + tag pickers,
and any future surface meeting both conditions.

**Apply only when both invariants hold:**

1. There is a finite list of candidate values to choose from.
2. The user is allowed to _add_ new values to that same list.

If a field only searches a fixed catalog (country / currency /
timezone — the user can pick, not add), use a plain `<select>` or
typeahead instead. This pattern is reserved for the pick-or-create
case.

**Anchor invariants of the pattern:**

- **Search input.** Single text input, `placeholder="Search <plural>..."`
  (e.g. `Search tags...`, `Search beneficiary...`). Filters the
  dropdown as the user types.
- **Dropdown opens on focus**, closes shortly after blur (use a
  ~200 ms setTimeout so click handlers on options can fire before
  the dropdown unmounts).
- **`+ Add new <singular>` is the FIRST item** in the dropdown
  (sticky-top, visually distinct from the list options). It must
  **always be visible** — including when search returns zero
  matches. The user should never be stuck because what they want
  to add doesn't exist yet.
- **Empty / no-match state** appears below the Add CTA, not in
  place of it: `"No matches"`.
- **Clicking Add** opens the corresponding `<XyzFormDialog />`
  (modal pattern above). On save, the parent **refreshes the
  source list** and, for single-select, **auto-selects** the new
  entry; for multi-select, **auto-appends** it.
- **Selection-state rendering depends on cardinality:**
  - **Single-select:** the chosen value lives _inside_ the search
    input — pick replaces the search text with the value's label;
    the dropdown closes; the parent is responsible for caching the
    chosen id alongside the visible name. No chip rail.
    Reference: `BeneficiarySearch`.
  - **Multi-select:** every pick appends a chip to a rail rendered
    _below_ the input. Chips carry a `×` remove button. Already-
    selected ids are filtered out of the dropdown so the same
    value can't be re-picked.
    Reference: `TagSelector`, categorization-rules tag picker.
  - **Feature-specific chip enrichment** (e.g. "Primary" badge +
    "Set Primary" buttons on categorization-rule tag chips, alias
    bracket display on beneficiary chips) is allowed on top of the
    multi-select base. It's a _layer over_ the pattern, not a
    deviation from it.
- **Type-then-create flow:** if the user types a name not in the
  list, the Add CTA stays at top of the dropdown. Optionally
  pre-fill the dialog's Name with the current search text so the
  user doesn't retype (see `BeneficiaryFormDialog` `initialName`).

**Reference implementations (live in the repo):**

- `features/transactions/components/BeneficiarySearch.tsx` — single-
  select, opens `BeneficiaryFormDialog`.
- `features/transactions/components/TagSelector.tsx` — multi-select,
  opens `TagFormDialog`.
- `features/categorization/pages/CategorizationRulesPage.tsx`
  inline tag picker — multi-select with Primary semantics, opens
  `TagFormDialog`.

**Reason to extract a shared component later:** when a fourth
surface adopts this pattern with the same single/multi shape, fold
into `shared/components/SearchableList.tsx`. Until then the
copy-paste keeps each surface free to apply feature-specific chip
rendering (Primary tag, alias bracket display) without a shared-API
re-design.

## Searchable dropdowns (when required)

Locked 2026-05-29. Complements the
"Searchable list with inline create" pattern above; this convention
covers the **pick-only** case (no `+ Add new` CTA — the candidate
set is closed).

**A dropdown / selector MUST be searchable (typeahead-narrowed)
when ANY of these hold:**

1. **Size:** > 15 candidate items.
2. **Nature:** data-driven (backed by a user-extendable or
   backend-populated list that grows over time).
3. **No inherent scan order:** alphabetical-by-name across many
   items where visual scan past ~15 is slow.

**Plain `<select>` is correct when ALL of these hold:**

- ≤ 15 items, AND
- inherent semantic / chronological order (months, years, priority
  levels), AND
- native browser type-letter behavior (jumps to first match by
  initial letter) does the job.

**Shared component:** `shared/components/SearchableSelect.tsx`.
Single-select typeahead, ARIA combobox + listbox + option +
`aria-activedescendant`. Keyboard nav: ↑/↓ moves highlight, Enter
selects, Esc closes; hover updates highlight so click + keyboard
don't conflict. The component composes a clear button + chevron
toggle; the empty-value option (e.g. "All tags") is just an
ordinary entry in `options[]`.

**Decision matrix for current pickers:**

| Surface                                           | Convention                                                                 | Reason                                                                                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Beneficiary picker (Add/Edit Tx, Categorization Rules) | `SearchableSelect` (+ `onCreate` Type A)                              | Data-driven, user can add. Pick-only — typing filters; create via the CTA                                                                                                            |
| Tag picker (Add/Edit Tx, Categorization Rules)   | `SearchableMultiSelect` (+ `onCreate`; `renderToken` for primary/promote)  | Data-driven, multi-select, user can add                                                                                                                                             |
| Tag dropdown in Filter Sidebar                    | `SearchableSelect`                                                         | Data-driven, often > 15                                                                                                                                                              |
| Beneficiary category (Beneficiary form)           | `SearchableSelect`                                                         | Data-driven, ~25+ tags in the default seed                                                                                                                                           |
| Merchant search bar (Transactions filter row)     | `SearchableSelect` (compact, label-less wrapper)                          | Folded onto the shared component (T-typeahead-consolidation); only the on-mount beneficiary load stays local                                                                        |
| Admin user picker (bill-backfill)                 | bespoke (`AdminUserPicker`)                                                | **Carve-out:** async server-search (debounce + 3-char gate + loading state) + selected-user card — distinct from the pre-loaded pick-only model; not worth complicating the shared component |
| Country picker (Register, Profile)                | `SearchableSelect`                                                         | 250 items                                                                                                                                                                            |
| Currency picker (Profile, Preferences)            | `SearchableSelect`                                                         | 170 items                                                                                                                                                                            |
| Timezone picker (Register, Profile)               | bespoke `TimezoneSelect` (country-narrowing + `SearchableSelect` fallback) | Specialised filter cascade; full IANA fallback is searchable per the >15-items rule                                                                                                  |
| Bank-account picker (Add / Edit transaction)      | plain `<select>`                                                           | Per-user count is bounded (≤ ~5 in practice); the "user-extendable" trigger doesn't fire because users don't accumulate accounts past a visual-scan threshold. Documented carve-out. |
| Month dropdown (Transactions filter)              | plain `<select>`                                                           | Sequential, 25 items, native jump works                                                                                                                                              |
| Type filter (debit/credit/all)                    | pill toggle                                                                | 3 items — toggle, not dropdown                                                                                                                                                       |
| Sort field / direction (Filter Sidebar)           | plain `<select>`                                                           | ≤ 4 items, fixed                                                                                                                                                                     |
| Date format / number format pickers               | plain `<select>`                                                           | ≤ 10 items, semantic groups                                                                                                                                                          |

**Anti-patterns to avoid:**

- Wrapping a small fixed list (e.g. debit/credit/all) in a
  searchable component — adds chrome for no benefit; use a pill
  toggle instead.
- Using `<select>` for a 200-item list because "it's just an
  internal screen" — slow scrolling burns user time daily.
- Building per-feature typeahead components when
  `SearchableSelect` would compose. Reach for it first; only
  diverge when the pattern needs feature-specific chips /
  cascading filters that wouldn't fit a shared API.

All data-driven / >15-item selects use the shared `SearchableSelect`;
`CountrySelect` and `CurrencySelect` are built on it.

### The shared typeahead family (engine + two shells)

Locked 2026-06-21. Every "search input + dropdown" picker is built
from one headless engine + one of two shells, so behaviour
(filtering, keyboard nav, open/close, click-outside, pick→clear) is
single-sourced rather than re-implemented per feature.

- **`shared/hooks/useTypeahead`** — the headless engine. Owns the
  query, open state, the query-filtered list, keyboard nav (via
  `useTypeaheadKeyboard`), close-on-click-outside, and the
  pick→clear-query→close orchestration. Returns `getInputProps()` /
  `getOptionProps()` to spread + `containerRef` / `listRef`. The
  active row re-pins on query / list-length change — **never** on the
  options array reference — so a parent that rebuilds `options` each
  render can't freeze arrow-nav.
- **`shared/components/SearchableSelect`** — single-select shell.
- **`shared/components/SearchableMultiSelect`** — chip-accumulating
  multi-select shell. Each pick (or create) adds a chip and resets the
  query. Per-consumer chip differences come through `renderToken`
  (default = a plain removable accent pill; categorization tags pass a
  primary-badge + promote variant).
- **`shared/components/TypeaheadPanel`** + `CreateOptionCTA` — the
  shared dropdown surface (create CTA + listbox + empty state) both
  shells render.

**Two distinct kinds of "create" — do not conflate them:**

- **Type A — create a new selectable OPTION** (`onCreate` slot, the
  "+ Add new" CTA). Present **only** when the option list is a
  user-CRUD-managed list (tags, beneficiaries) — never for fixed /
  system lists (countries, currencies, timezones). The shell only
  renders the CTA and fires `onCreate`; the consumer owns its own
  create modal (`TagFormDialog` / `BeneficiaryFormDialog`) so feature
  boundaries stay intact. The new entity becomes an option (and is
  typically auto-selected).
- **Type B — add a SELECTION to the multi-select chip set.** Picking
  an existing option appends a chip. This is just what
  `SearchableMultiSelect` does; it mutates the selected values (local
  form state), not the option source.

They compose: the categorization-rule tag picker is multi-select
(Type B) **and** create (Type A).

**Migration notes (T-typeahead-consolidation, 2026-06-21):**

- The transaction **beneficiary** field is **pick-only** — typing only
  filters; a brand-new beneficiary is created via the "+ Add new
  beneficiary" CTA, not by free-typing a name and submitting (the old
  free-text-create affordance was removed for a single shared model).
- **`AdminUserPicker`** stays bespoke (async server-search carve-out, see
  the matrix above).
- **`SearchableSelect` keeps its own internals** (draft↔value sync,
  click-to-clear-on-focus) rather than being refactored onto the
  `useTypeahead` engine — its single-select external-value sync differs
  enough from the multi-select that converging would complicate the
  engine for no real payoff. The engine backs `SearchableMultiSelect`;
  the two shells share the dropdown surface (`TypeaheadPanel`) and
  keyboard hook (`useTypeaheadKeyboard`), which is where the duplication
  actually mattered.

## DetailModal (canonical view + edit surface)

Locked 2026-05-29. The in-modal behaviour: form always rendered, no
view/edit toggle. **Every CRUD-shaped feature exposes a single
canonical DetailModal as both the view-everything surface and the
edit surface.** Triggered by a row-level `⋯` (Lucide
`MoreHorizontal`) button on the right edge of each row/card.

**Why one modal, not two surfaces:** the alternative ("view page" +
separate "edit modal") triples the cognitive load — three click
paths, three render trees, three places to keep in sync. The
DetailModal collapses that to one surface where the form layout is
identical on open and after edits; per-field editability is the
field's own property (some fields render as readonly inputs, some
as live inputs).

**Anchor invariants:**

- **Trigger:** `⋯` icon button on the right edge of every row /
  card, sized 28–32 px to match the modal-header chrome
  (existing close X + Trash buttons).
- **URL state:** opens via `?edit=<id>` (existing pattern) or a
  feature-specific equivalent. Reloads land on the modal; deep
  links work.
- **Shows every relevant field** from the API response — even
  fields hidden in the row. The canonical example is the
  transaction `notes` field: not displayed on the row, fully
  visible + editable inside the modal. Anything the backend
  returns and the user might want to read goes here.
- **Per-field editability is the field's call.** Readonly fields
  render as `<input readOnly>` with muted styling
  (`cursor-not-allowed`, slate-50 background). HTML `disabled`
  swallows clicks, so `readOnly` + `onClick` is the workable
  shape — clicking a readonly field surfaces the
  `LockedFieldBanner` at the top of the modal explaining the
  lock and what IS editable. Editable fields render as live
  inputs. Source-gated rows (e.g. statement-imported
  transactions) gate edit-ability of individual fields, not the
  whole modal.
- **No view/edit mode toggle.** The form layout is identical
  regardless of dirty state — the transition between fresh-open
  and edited-dirty is invisible to the user. State is tracked
  internally for the dirty-confirm path; the only visible
  difference is the dismiss button text-swapping `Close` ↔
  `Cancel` and the Save button enabling once `isDirty`. (A brief view-first experiment was rejected
  for being too visually disruptive.)
- **Title = entity identifier.** Beneficiary name, tag name,
  budget `tag_name` (e.g. `Edit budget — Groceries`), taxation
  rule `txn_type` capitalised, generated rule name. Add flow
  gets a `New <Feature>` prefix.
- **Footer convention.** Cancel/Close on the LEFT of the
  right-cluster (`justify-end gap-2`), Save on the RIGHT.
  Buttons size to content — no full-width buttons. Save is
  disabled until `isDirty`. The dismiss button's label
  text-swaps `Close` (clean) ↔ `Cancel` (dirty); both route
  through the same `confirmOnDirty` close path the Modal's X
  button uses.
- **One canonical component per feature** — `<FooFormDialog>`
  mounted in both row-click (edit) and list-header (add)
  contexts. The component branches its internal state on
  `editing != null`; no duplicate forms.
- **Delete lives in the modal header** per the existing
  "Modal-header destructive actions" convention (next section).
  When delete is unavailable (system rows, locked entities), the
  trash button is omitted, not disabled-with-tooltip.
- **System / locked rows still render `⋯`** so the entry-point
  is consistent. Inside, fields show as readonly and the trash
  is hidden.

**Reference implementations (live in the repo):**

- `features/transactions` — row `⋯` → `?edit=<id>` modal.
- `features/beneficiaries` — `BeneficiaryFormDialog` (full-field
  view+edit; add+edit branch on `editing` prop).
- `features/tags` — `TagFormDialog` (system tags render readonly).
- `features/budgets` — `BudgetFormDialog`.
- `features/categorization` — `CategorizationRuleFormDialog`.
- `features/taxation` — `TaxationRuleFormDialog` for rules,
  `BillDetailDialog` for bills (read-only DetailModal — bills
  aren't edited, only viewed + paid).
- `features/recurring` — `RecurringFormDialog`.
- `features/bankAccounts` — `BankAccountFormDialog`.

All CRUD features above comply; new features adopt this convention
from the start.

## Modal-header destructive actions (Remove-in-edit)

Locked 2026-05-27. **Every edit
modal that operates on a deletable entity surfaces an icon-only
Remove (Trash) button in the modal header, between the title block
and the close X.** Discoverable inside the edit context without
crowding the Cancel / Save footer.

**Anchor invariants:**

- **Render only in edit mode.** Add-mode (no `editing*` prop) hides
  the Remove button — there's nothing to remove yet.
- **Icon-only, sized 32×32.** Matches the close X chrome. Danger
  tint (`text-danger-600 dark:text-danger-400` with
  `hover:bg-danger-50 / dark:hover:bg-danger-950/40`) differentiates
  from the close X without dominating the header.
- **`title` + `aria-label` carry the text label** (e.g. "Remove
  beneficiary") — keyboard / screen-reader friendly; tooltip
  surfaces on hover.
- **Click opens an existing `<ConfirmDialog intent="danger">`** —
  never a direct delete. The page owns the confirm + mutation flow;
  the dialog stays focused on the form. Pattern: pass a
  `onRequestRemove` prop into the form dialog that the parent
  wires to `setConfirmDelete(entity)`.
- **Closes the edit modal on successful delete.** The page's
  `onConfirm` handler calls both the existing delete mutation AND
  `editModal.close()` so the user doesn't see a stale "not found"
  state after the row is gone.
- **Row-level Delete coexists.** List pages keep their per-row
  Delete buttons (BeneficiariesPage, TagsPage,
  CategorizationRulesPage, TransactionsPage). Two valid paths: row
  Delete for quick wipes; modal Trash for "while I'm editing, I
  want to delete instead". Mental model is consistent because the
  same `ConfirmDialog` fires in both cases.

**Where the convention applies:**

| Modal                                                                              | Status  | Notes                                                                                                                                    |
| ---------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BudgetFormDialog`                                                                 | ✅      | Modal is the primary delete surface (no row-level delete on the cards).                                                                  |
| `BeneficiaryFormDialog`                                                            | ✅      | Row + modal both available.                                                                                                              |
| `TagFormDialog`                                                                    | ✅      | Row + modal. Hidden when `editingTag` is a system tag (`created_by === null` or `=== SYSTEM_USER_ID`).                                   |
| Transactions edit modal                                                            | ✅      | Gated on `editingTxn.source === 'manual'` — statement-imported txns can't be deleted (matches the row-dropdown gate).                    |
| `RecurringFormDialog`                                                              | ✅      | Modal is the primary delete surface — soft-deactivate via DELETE on the template uid.                                                    |
| `BankAccountFormDialog`                                                            | ✅      | Modal is the primary delete surface — hard-delete; statement-upload identifier matches stop working (warning copy in the ConfirmDialog). |
| `CategorizationRuleFormDialog`                                                     | ✅      | Header Trash for user rules; hidden when `isUserRule` is false.                                                                          |
| `TaxationRuleFormDialog`                                                           | ❌ skip | Canonical 4 txn_types are system rows; "customize vs fall back to default" is the model, not "delete".                                   |
| `BillDetailDialog`, `GenerateBillsDialog`, `MergeBeneficiariesDialog`, `AuthModal` | ❌ skip | View-only or action surfaces; nothing to delete.                                                                                         |

**Shared infra:** `shared/components/Modal.tsx` exposes a
`headerActions?: React.ReactNode` slot rendered between the title
block and the close X. Future modals that need a destructive header
action consume this slot — no new infra per surface. It also exposes
`dismissible?: boolean` (default `true`); set `false` for
must-acknowledge surfaces (e.g. the one-time 2FA backup-codes reveal)
to hide the close X and block Escape / overlay-click — the modal then
closes only via an explicit in-content action wired to `onClose`.

**System / restricted entities:** when a class of entities can't
be deleted (system tags, locked rows, etc.), the parent omits
`onRequestRemove` in the form dialog and the icon doesn't render.
Avoids the disabled-button-with-tooltip pattern that suggests "you
might be able to do this later" — the action is genuinely absent.

## QR codes

**All QR rendering goes through `shared/components/QrCode.tsx`.** It is a
value-agnostic primitive: the caller builds the encoded string (a URL, an
`otpauth://` URI, a future `upi://pay?…` intent) and owns when to obtain it
(a button-triggered mutation, or an eager on-mount fetch for a dedicated QR
page) — the component only renders. It **internally `lazy()`-loads**
`qrcode.react` (via `QrCodeSvg.tsx`) so the library sits in its own async chunk
and never enters the initial-JS budget in `.size-limit.json`; consumers get the
code-split + `<Suspense>` for free.

- **Scan-safe:** drawn dark-on-white in **both** themes (scanners need contrast —
  never inverted), with a built-in quiet zone and `role="img"` + aria-label.
- **`caption?`** (opt-in) renders the encoded value as copyable text under the
  QR. Pass it **only for short, NON-SENSITIVE values** (a URL or UPI id), judged
  per consumer — it is never auto-derived from `value`. 2FA enrollment passes no
  caption because its `otpauth://` URI carries the TOTP secret; the base32 secret
  is surfaced separately as the manual-entry path.
- **`level?`** (default `'M'`) is reserved to bump error-correction to `Q` / `H`
  for a future logo-overlay QR (e.g. UPI payments).

Future UPI-payment QRs (paying bills / consumption tax from the savings account,
pre-mobile-app) will reuse this primitive once the payment + security flow lands;
the `upi://pay?…` intent-builder and VPA plumbing are deliberately **not** built
yet (no structure for them).

## Chip tones

Small pill/badge chips carry a **semantic tone**, not an arbitrary color:

- **Slate** (`bg-slate-100 / text-slate-600`) — neutral metadata: tag chips, the
  System provenance chip. The default; most chips are slate.
- **Violet** (`bg-violet-100 / text-violet-700`, dark `violet-950/violet-300`) —
  marks something **significant and/or interactive**. The recurring chip
  (`shared/components/RecurringChip.tsx`) is the first user: it flags a txn that
  settled a recurring bill, and when given a `templateId` it becomes a `<Link>`
  to that template (with a `hover:bg-violet-200` affordance). Reuse violet for any
  future chip that's notable or links somewhere — keeps "this is special / you can
  click it" visually consistent and distinct from neutral tags and the teal
  brand-accent (which means "brand / focus ring"). The transient
  [row-highlight](#row-highlight-on-save) glow shares this violet tone (a
  theme-stable "pay attention here"), so chip and flash speak one visual language.
- **success / warning / danger** — status tones, reserved for state (e.g. a
  breach or low-balance pill), not for marker chips.

## System provenance chip

**Seeded rows wear a "System" chip.** `shared/components/SystemChip.tsx`
is a small presentational badge rendered on any row the backend marks
`is_system` — beneficiaries, categorization rules, taxation rules, and
tags. It signals **provenance, not ownership**: `is_system` is derived
backend-side from `created_by` (null or `== SYSTEM_USER_ID`), and the
codebase **does not transfer provenance on edit**, so the chip stays put
after a user customizes a seeded row. The word is deliberately
**"System"** (not "Default") because the row keeps the chip even once
edited — "Default" would stop being true. Tooltip: "Created by the
system. You can still edit or remove it." The chip is purely a read of
the BE `is_system` flag — no client-side `created_by` comparison (that
logic lives once, on the server).

## Activity callouts (surfacing feed items outside the bell)

**The TopNav bell is the primary activity inbox; any _other_ surface
that shows feed items uses `shared/components/ActivityCallout.tsx`.**
B1's dashboard enrichment established the pattern: a card pulls a
domain-scoped slice via `useDomainActivityQuery(domain)`
(`shared/api/activityFeed.ts` — `?domain=` reuses the bell's reader
path + per-user `disabled[]` filter, keyed separately so caches don't
collide), filters client-side to the kind(s) it cares about, and
renders an `<ActivityCallout>` per item.

Rules a new consumer inherits:

- **Reuse, don't fork** the shared machinery: `iconForKind`
  (`shared/utils/activityIcon.ts`), `priorityTone*`
  (`shared/utils/activityPriority.ts`), `subjectMeta`
  (`shared/utils/activitySubject.ts`). New BE kinds degrade
  gracefully (unknown icon → `Bell`, unknown subject → no CTA).
- **Hard-ack on dismiss only.** Callouts never soft-ack on render —
  the bell stays the sole owner of the soft-seen lifecycle, so a card
  showing an item doesn't silently mark it seen. Dismiss fires
  `{hard: true}`, which (per the BE Law) MUTEs an alert (resurfaces
  later) or DELETEs a notification.
- **Splice only _additive_ signals.** Don't surface an activity event
  a card already renders from its own live data (a budget breach, a
  forecast bill) — that just prints the same thing twice. B1 wired
  only `tax_mode_auto_disabled` + `bill_overdue` for this reason.
- **Live state ≠ activity.** A persistent "this mode is off" nudge is
  a read of the live flag (e.g. `useTaxModeStore`), not a feed item;
  layer the dismissible activity notice _on top_ of it (the Tax
  Tracker card's two-layer banner) rather than conflating them.

## Redirect over nested modal for full-feature surfaces

A refinement of the modal-first CRUD default. Two shapes of "sub-flow
from within a parent context":

- **Lightweight value-object creation → nest a modal.** Minting a
  missing beneficiary or tag while filling another form opens the
  owning feature's small create dialog *on top of* the current one
  (`BeneficiaryFormDialog` / `TagFormDialog`, sanctioned by the
  `eslint-plugin-boundaries` allow-list). The in-flight draft survives;
  there's no standalone page worth leaving for.
- **Another feature's full editor surface → redirect, don't nest.**
  When the sub-flow *is* a complete feature surface with its own page
  (the categorization-rule editor), the parent saves its own work and
  **navigates** to the owning page with prefill state rather than
  importing+rendering that feature's dialog. This keeps the feature
  boundary closed (no cross-feature component import) and avoids a
  heavy modal-on-modal stack. The cross-feature contract is a
  presentational review modal in `shared/` (e.g.
  `RuleReviewModal`) plus a typed navigation payload in
  `shared/navigation/` (e.g. `rulePrefill.ts`) — never the other
  feature's editor. See [transactions.md](modules/transactions.md) /
  [categorization.md](modules/categorization.md) for the worked
  example (transaction entry → categorization rules).

## Row highlight on save

Locked 2026-05-26. **Every list
page that hosts add / edit modals briefly highlights the row that
was just created or saved.** The intent is to neutralize the
surprise of a modal closing into a re-rendered list — the user's
eye lands on the changed row instead of scanning the table.

**Anchor invariants:**

- Highlight kicks in on **both create AND edit** success, not just
  edit. Symmetric UX: every save → glow.
- Visual: a **violet glow pulse** — a ring + soft halo that ramps in
  fast then fades smoothly over **~2 s**, never abrupt. Never hand-write
  the class — call `highlightClass(highlighted, variant?)` from
  `shared/utils/highlight.ts` and concatenate it into the element's
  `className`. The glow (`highlight-pulse` keyframe in `index.css`)
  animates the **element's own `box-shadow`** — deliberately *not* a
  child `::after` overlay, because a child's outer halo is **clipped by
  an `overflow-hidden` ancestor** (the rounded Preferences cards), while
  an element's own box-shadow paints outside its border box, is never
  clipped by its own overflow, and follows its `border-radius` natively.
  The tone is
  **violet and theme-stable** — one hue in both light and dark
  (deliberately *not* the `accent` token, which flips teal/indigo per
  theme and is shared with chrome). Violet is the app's "pay attention
  here / significant" signal (same family as the `RecurringChip`, see
  [Chip tones](#chip-tones)), kept constant so the glow reads identically
  everywhere. Single-point retone: change the keyframe, not the call
  sites. `prefers-reduced-motion` collapses the animation to a static
  ring. (The `variant` param is kept for call-site back-compat; both
  variants resolve to the same glow today.)
- **Always auto-scrolls the item to centre.** `useRowHighlight` centres
  the highlighted element from a **post-commit effect** (so the row is at
  its FINAL position even when a save reorders/rebuckets the list), every
  time — *not* gated on visibility. A `block: 'nearest'` / visible-only
  guard was tried and rejected: a row that moves but stays partly on
  screen then wouldn't scroll at all, losing the user's place. The whole
  point is to relocate the item, so it's always brought to focus. Single
  mechanism (`scrollHighlightIntoView`, finds the element by its
  `highlight-pulse` class) — never hand-roll an imperative `scrollIntoView`
  from a save handler (it runs before the re-render commits and lands on
  the stale position).
- The highlight **does not block subsequent interactions** —
  clicking another row, opening another modal, or sorting the
  list cancels the timer cleanly.
- **One timer, one row at a time.** Triggering the highlight on a
  new row cancels the previous timer.

**The feature is two co-operating pieces** — keep them paired:

- **State + scroll:** `shared/hooks/useRowHighlight.ts` returns
  `{ id, flash }` (default ~2 s timer, matched to the keyframe). Callers
  wire `flash(id)` into the modal's `onSaved` and compare `id === row.id`
  for the row. It also **auto-scrolls** the highlighted element into view
  (post-commit, off-screen-only — see above) with no per-consumer wiring.
- **Style:** `shared/utils/highlight.ts` — `highlightClass()` + the
  `HIGHLIGHT_PULSE` token (the `highlight-pulse` class) + the
  `scrollHighlightIntoView()` helper. The single source for the glow +
  scroll, so the look is one edit away (retone in the `index.css` keyframe).

**Pick the trigger by whether the user *navigated* to the page** — the
look (the glow) is always `highlightClass`; only the *trigger* differs:

| Trigger | Mechanism | Param consumed? |
| --- | --- | --- |
| **In-place** — a modal closes back onto the same page (create/edit). No navigation, no URL change. | `useRowHighlight` directly; `flash(id)` in the modal's `onSaved`. | n/a — there's no param. **Don't** manufacture a `?highlight=` for an in-place save (URL churn, and it'd wrongly survive refresh). |
| **Deep-link via URL param** — a redirect lands the user on a page to point at one item. | `useDeepLinkHighlight` (reads `?<param>=`). | **Yes** — the hook consumes the param (`replace`). |
| **In-place, multi-target / with a side-effect** — one save must glow *and* do more (glow two rows, force-open a containing group, scroll). | A feature-local state machine is acceptable, **but it must still** (a) paint via `highlightClass` and (b) use the shared `HIGHLIGHT_DURATION_MS` so its timer matches the keyframe. | n/a — still in-place, no param. |

The middle row is the default for any new navigate-to-highlight flow.
The bottom row is the sanctioned exception (`useRowHighlight` tracks a
single id, so genuine multi-target cases need their own state) — not a
license to hand-roll a single-row highlight.

**Deep-link landing — "point at this on redirect".** The same flash is
the standard way to point a user at one item after a cross-page
redirect: the source links with a `?highlight=<key>` (or `?template=…`)
param, and the destination flashes the target — `useRowHighlight`'s
auto-scroll then brings it into view, so the hook itself doesn't scroll.
**Always go through the shared `shared/hooks/useDeepLinkHighlight.ts`
hook** — don't hand-roll the effect:

```ts
const { id, flash } = useRowHighlight<string>();
useDeepLinkHighlight({
  param: 'highlight',
  flash,                       // shares the page's row-highlight state (+ its scroll)
  ready: !isLoading,           // fire only once the target is rendered
  accept: (v) => v === 'tax-mode',
});
```

The hook bakes in the two rules that keep it robust:

- **Fire once the target is rendered, not on the raw mount.** If the
  page shows a loading skeleton first, flashing on the loading mount
  burns the ~2 s timer (and StrictMode's mount/unmount clears it) before
  the element paints. Pass the page's ready flag (`!isLoading` /
  `templatesReady`).
- **Consume the param so a refresh doesn't re-flash.** The cue belongs
  to the redirect, not the URL — a manual reload is no longer an
  "arrival", so the hook clears the param (`replace`) after firing. A
  fresh navigation that re-sets the param still re-targets.

Both deep-link sites (`AccountPreferencesPage` → `?highlight=tax-mode`,
`RecurringPage` → `?template=<uid>`) route through it.

Reference implementations:

- **In-place save-flash:** `BeneficiariesPage`, `TagsPage`,
  `TransactionsPage`, `BankAccountsPage`, `ExpenseTrackerPage`,
  `TaxationRulesPage`, `TaxTrackerPage` (generate/mark-paid),
  `RecurringPage` (confirm/save). All `useRowHighlight` + `flash` in
  `onSaved` — no param.
- **Deep-link via URL param:** a transaction's recurring chip →
  `/recurring?template=<uid>` (row); the dashboard Tax Tracker "turn it
  back on" banner → `/account/preferences?highlight=tax-mode` (card).
  Both via `useDeepLinkHighlight`.
- **Sanctioned multi-target exception:** `CategorizationRulesPage`'s
  highlight fires **in-place on save** (`handleSaved` → `highlightRule`),
  but it must glow the saved rule row, force-open its containing group,
  and scroll the row into view — the save *rebuckets* the list (the rule
  moves to a new group), so the off-screen-only auto-scroll genuinely
  fires here. Two targets `useRowHighlight` (single id) can't express, so
  it keeps a feature-local state machine — but still reuses the shared
  pieces: `highlightClass()` glow (in `GroupedRulesList`),
  `HIGHLIGHT_DURATION_MS` for its timer, and `scrollHighlightIntoView()`
  from a post-commit effect (keyed on the highlighted uid) so the scroll
  lands at the row's final post-rebucket position. (Its `location.state`
  consumption is a separate concern — the rule-prefill modal handoff, not
  the highlight.)

## Idle-time prefetch

Locked Platform FE Batch 20 UAT (`aca6817`). **Click-gated chunks
that gate first-paint behind a lazy boundary should warm during
the browser's idle window after the user lands.** Sub-page surfaces
the user hasn't clicked yet — TopNav submenus, Accessibility
panel, lazy modals, route chunks for the most-clicked paths —
shouldn't block first paint, but they also shouldn't pay the
load-on-click latency every time.

**Shared hook + helper:**

- [`shared/utils/prefetchOnIdle.ts → prefetchOnIdle(fn, delayMs)`](../../src/shared/utils/prefetchOnIdle.ts)
  schedules `fn` (which returns a dynamic `import(...)`) for
  `requestIdleCallback` after `delayMs`, with `setTimeout`
  fallback for browsers without RIC. WeakSet-memoized — the same
  `fn` won't run twice across re-mounts.
- `useIdlePrefetch(entries: PrefetchEntry[], enabled: boolean)`
  takes a list of `{ delay, importer, label }` and registers each
  via `prefetchOnIdle`. Cleanup on unmount cancels still-pending
  timers (the loaded chunks stay cached).

**Schedule lives in `app/`, not `shared/`** — the eslint
`boundaries` rule blocks `shared/ → features/` imports, but the
schedule needs to dynamic-import feature pages. Two canonical
schedules:

- [`app/idlePrefetchSchedule.ts → AUTHED_PREFETCH`](../../src/app/idlePrefetchSchedule.ts)
  — used by `App.tsx` once `useAuthStore.user` is set. Stagger 2–8 s
  (most-clicked first): TopNav menus (2 s), Transactions (2.5 s),
  ExpenseTracker (3 s), TaxTracker (3.5 s), ActivityFeedModal +
  AccessibilityPanel (4 s), … through the long tail.
- `ANON_PREFETCH` — used by `app/pages/Home.tsx` for the anonymous
  landing page. Warms `AuthModal` after 2 s.

**Exemptions** — surfaces that need to load _immediately_ on a
user action skip the schedule and force-prefetch on mount of the
relevant page. Example:
[`UploadStatementPage`](../../src/features/transactions/statement_upload/pages/UploadStatementPage.tsx)
prefetches `StatementUploadDock` on mount so the bottom-right dock
is visible the instant the user submits and the page navigates
away.

**When NOT to add a chunk to the schedule:**

- Chunks loaded by 99% of users in the first 5 s anyway (the
  dashboard route — eagerly imported, not lazy).
- Chunks gated by domain-specific state the user might never
  enter (Admin portal — only mounted for SYSTEM-role accounts;
  the route lazy-imports naturally, no idle warm needed).

The schedule is the budget — adding a row makes it longer for
everyone. Add only when usage data (or a UAT round) flags a
specific click-gated chunk as slow.

**Stub-then-hydrate triggers must stay visible.** A click-gated
lazy surface that swaps a stub trigger for a `<Suspense>` boundary
must use the **stub itself as the fallback**, never `fallback={null}`
— otherwise the trigger (e.g. the TopNav Settings cog / Account
avatar) blinks out during any residual load lag. Pair it with an
intent-prefetch: warm the chunk on the trigger's `onMouseEnter` /
`onFocus` (on top of the idle schedule) so the click usually
resolves from cache. See `shared/components/TopNav.tsx`
(`SettingsTrigger` / `UserTrigger` + `prefetchTopNavMenus`).

## Accessibility vs Preferences

Locked 2026-05-26, reclassified 2026-06-01 after BE Phase 1.9 +
Platform FE Batch 2. Two distinct user-pref classes live in this
app — they look similar but persist and surface differently:

- **Device accessibility** — frontend-only, no backend column.
  Survive reloads via `localStorage` (Zustand `persist`), do NOT
  follow the user across devices. Implemented as small Zustand
  stores with a `bridge` in `app/providers.tsx` that mirrors store
  state onto the `<html>` element (class or style). No-FOUC inline
  in `index.html` paints the initial state before React mounts.
  These are device-shaped settings — the right value on the user's
  desktop may be wrong on their phone. Examples: theme (light /
  dark / system), text size (zoom), reduced motion, privacy mask.
  Surfaced under a single **Accessibility** group —
  `<AccessibilityPopover />` on desktop (a single icon button in
  the top bar opening a popover with all four controls) and a
  dedicated **ACCESSIBILITY** section in the mobile drawer.
- **Preferences** — backend-persisted via the `user_preferences`
  row (§5 above); follow the user across devices. Hydrated at boot
  by `hydratePreferences()`, and every user-driven `setX()` fires
  a PATCH side-effect via `subscribeToPreferenceStores()`. The
  full SoT set is: currency, timezone, date*format, number_format,
  landing_route, default_txn_kind, underline_links,
  focus_ring_always, auto_enabled (the taxation auto-finalize toggle
  added in BE Phase 2.6 — Decision 26). **Note:** underline-links and focus-ring-
  always \_are* a11y flags by behaviour (they affect contrast /
  visible focus) but live in Preferences because the right value
  is a property of the _user_, not the _device_ — a user who needs
  a visible focus ring on their laptop needs it on their phone
  too. Surfaced on the account surface — currency / timezone /
  country on `/account/preferences`, the rest on
  `/account/accessibility` (UI grouping by feel, not by SoT).

**Pattern for new Accessibility surfaces** (in case more get
added):

1. Zustand store with `persist` middleware + an `apply<X>(value)`
   imperative that mirrors state onto `<html>` (class, style, or
   data attribute).
2. `<XBridge />` in `app/providers.tsx` that calls `apply<X>` on
   mount + every store change.
3. No-FOUC inline `<script>` in `index.html` that paints the
   initial state from `localStorage` before React mounts.
4. CSS rule (when applicable) under `@layer base` in
   `src/index.css` that observes the `<html>` class.
5. UI control (`<XToggle />` or similar) shaped as a single
   labeled row — label on the left, control on the right — so it
   slots into both the drawer and the AccessibilityPopover.

**Money rendering for privacy mask compatibility.** Any element
that renders a currency amount must carry `className="money"` so
the privacy-mask CSS rule (`html.mask-amounts .money`) can blur
it. Examples in `features/transactions/pages/TransactionsPage.tsx`
amount cells. Future surfaces that render money adopt this
className as they're touched.

**Known carve-out — SVG `<title>` tooltips.** The privacy-mask
CSS targets styled DOM nodes; SVG `<title>` is an accessibility
metadata element that doesn't respond to CSS class selectors.
`ExpenseTrendChart`'s per-bar hover tooltip embeds `money(value)`
in a `<title>` and is therefore unblurrable from that surface.
Severity is low (the bar height already conveys magnitude) and
working around it would require a `<foreignObject>` overlay that
costs more bundle than the privacy delta. Documented here so
future readers don't flag it as a violation.

## Motion

Locked 2026-06-24; hoisted app-wide 2026-06-25 (consumers: the dashboard
redesign, then every page — incl. the pre-auth landing / auth / onboarding
flow). JS-driven animation goes through **framer-motion**, wrapped by the shared
foundation in [`src/shared/motion/`](../src/shared/motion/):

- **Always `m.*`, never `motion.*`.** `MotionProvider` runs `LazyMotion` in
  `strict` mode and code-splits the `domAnimation` **feature** bundle (~5 kB,
  loaded on the first `m.*` mount). `strict` makes a stray `motion.*` throw,
  keeping the discipline enforced. The LazyMotion + MotionConfig **core**
  (~11 kB gz) is *not* free, though — see the mount bullet.
- **Mounted app-wide** in [`app/providers.tsx`](../src/app/providers.tsx) so
  every surface — including the pre-auth landing / auth / onboarding flow —
  shares one context. This puts framer's ~11 kB core in the initial chunk; the
  `size-limit` JS budget was bumped to **135 kB** to carry it (app-wide motion
  is infrastructure, not a one-page flourish). That ceiling is **temporary** —
  `T-fe-perf` (B8) ratchets it back down via the react-router chunk + an
  analyzer-driven core trim. **Load-first still holds:** content renders fully
  and unanimated; motion is entrance/enhancement only and never gates the paint.
- **Reduced motion is a hard contract.** `MotionConfig reducedMotion` bridges
  both signals: the in-app `useMotionStore` toggle forces `'always'`, otherwise
  `'user'` follows the OS `prefers-reduced-motion`. Any custom motion hook (e.g.
  `useCountUp`) must honor the same pair and snap to the final state — a value
  must be correct on first paint with motion off. This extends the CSS
  `.reduce-motion` contract (see [Accessibility vs Preferences](#accessibility-vs-preferences))
  to JS animation.

### How to add motion to a page

The **two-beat** is the model: a card/section enters (beat 1), then its in-card
data animates (beat 2). A data-viz mark animates **only inside a `<Stagger>` or
`<Reveal>`**; outside one it renders **static** (final, no animation, no timers) —
so a page "adopts motion" by wrapping its zones, and pages that haven't are
untouched. Reduced motion → everything static.

1. **Provider** — nothing to do; it's app-wide (`app/providers.tsx`).
2. **Entrance** — wrap zones in the shared scaffold:
   ```tsx
   import { Stagger, StaggerItem } from '../../../shared/motion';

   <Stagger className="flex flex-col gap-6">
     <StaggerItem><ZoneA /></StaggerItem>
     <StaggerItem><ZoneB /></StaggerItem>
   </Stagger>
   ```
   `<Stagger>` fades/rises its `<StaggerItem>` children in sequence, and each
   `<StaggerItem>` publishes a "settled" signal a beat after it lands — which is
   what gates the second beat. Both forward every `m.div` prop. For bespoke needs
   reach for the raw variants (`fadeRise`, `scaleIn`, `drawIn`, `staggerContainer`)
   + `MOTION_TOKENS` (the single timing/easing source).
3. **Below-the-fold** — use `<Reveal>` instead: it scroll-reveals (framer
   `useInView`) AND drives the second beat, so charts/numbers animate as the
   section comes into view, not off-screen. To defer a heavy below-fold subtree's
   *load* to first-of { a from-mount timer, scrolling near it }, gate it with
   `useLoadOnApproach()` (a plain timer — NOT idle — so it never starves).
4. **Numbers** — `<CountUpNumber value format? />` (wrapping the `useCountUp`
   hook) counts a number up. **Headline / summary figures only** — never a
   list/table of values (slot-machine; list numbers ride their container's
   entrance). Framer-free, so safe even in the entry chunk.
5. **Progress / meters** — `<ProgressBar value />` fills from 0 (framer-free).
6. **Charts** — the `trendCharts` primitives (bars / line / donut) already draw
   in via `useDrawIn`; just render them inside a `<Stagger>`/`<Reveal>`. For a
   custom SVG mark, key a `hidden`/`show` variant off `useDrawIn()`.
7. **Reduced motion** — automatic; never branch on it manually (the `useCountUp`
   / `useDrawIn` / `<Reveal>` primitives already do).

**CSS animations** (framer-free — for the entry chunk + Radix data-state) use
**`tw-animate-css`** (`@import` in `index.css`) — the Tailwind v4 successor to
`tailwindcss-animate`, giving `animate-in`/`animate-out` + `fade`/`zoom`/`slide`
utilities. The codebase referenced these before the import existed (silent
no-ops); it's now the shared CSS-animation system every page wires into. Reduced
motion: the `.reduce-motion` override + `motion-safe:` apply. **Don't hand-roll
keyframes** for entrances — reach for this.

**The landing** is the reference for a first-paint-critical surface: above-the-fold
uses these CSS entrances (`motion-safe:animate-in fade-in slide-in-from-bottom-3` —
no framer → no flash, zero JS weight) while the below-the-fold showcases are
**lazy** + `<Reveal>` (their framer leaves the entry chunk). Defer a heavy
below-fold load with `useLoadOnApproach()`. Mirror this for any entry-chunk page.

**Modal motion** is a *central* scaffold: the shared `Modal` animates with **framer**
(`forceMount` + `AnimatePresence`) — the panel **rises + fades** in like a card and
**collapses** on close. Centering-safe by structure: the CSS centering lives on a
positioning *wrapper* while framer animates the inner *panel*, so the rise never fights
the `-translate` transform (the reason CSS-only failed here). Every dialog inherits it,
no per-page wiring; reduced motion → instant. It also publishes a **settled-after-open**
signal (`StaggerSettledContext`) consumed by the field reveal below. T-nav-ia-reorg added
the **`originRef` API**: pass the launching element's ref and the panel **flies out of it**
and collapses back into it (center-screen fallback when omitted — every existing consumer
is untouched). That's the *infra*; the per-surface wiring (each modal passing its trigger
ref) is the plumbing job in `motion-rollout-appwide.md`.

**Shared motion primitives (T-nav-ia-reorg — the rollout *consumes*, never re-authors).**
Each motion is defined once and imported everywhere, so a change in one place reflects
app-wide (DRY):

- **In-modal field reveal (3-beat)** — `shared/motion`: wrap a modal's field groups in
  **`<ModalReveal ready={…}>`** + **`<RevealField>`**. Panel lands → fields fade to 0 timed
  to the land → fields rise once **settled AND `ready`** (`useStabilizedEntrance`, 400 ms
  fallback so a slow fetch never strands it). `ready` = that surface's all-data-loaded flag.
  A modal that doesn't adopt the wrappers renders fields static (default no-motion).
  Reference consumers: bell / recurring / beneficiary / merge.
- **Field mutation** — `shared/motion`: **`<MutationPresence>`** + the **`mutationItemProps`**
  spread on each keyed `m.*` item → a derived field (e.g. assigned-tag chips) **fades the old
  / rises the new** every time its content recomputes. Keep `m.*` the direct child of
  `<MutationPresence>` so framer can animate its exit.
- **Menus & popovers** — `shared/components`: one **`MENU_SURFACE`** (`menuSurface.ts` — chrome
  + `data-[state]` fade, the single source) feeds **`<Menu>`** (Radix DropdownMenu — link/action
  menus that close on select) **and** **`<Popover>`** (Radix Popover — surfaces of arbitrary
  controls that stay open). Both inherit Radix's **native dismiss** (item-select / Escape /
  outside-click) + the fade-out from Presence, so **no dropdown hand-rolls dismissal** — the
  exact failure the accessibility popover hit before. Two primitives (different ARIA: `role=menu`
  closes-on-select vs `role=dialog` stays-open), one surface. `@radix-ui/react-popover` rides the
  lazy menu chunk (stub-then-hydrate triggers), so it's **0 kB on first paint** — only import
  `<Popover>` from a lazily-loaded surface to keep it that way.
  **Carve-out — do NOT migrate these onto `<Menu>`/`<Popover>`:** `SearchableSelect` is a
  **combobox** (`role=combobox`/`listbox`/`option` + typeahead + keyboard nav) — a different
  primitive than a `role=menu` DropdownMenu, and Radix has no filterable-combobox; forcing it
  over would be semantically wrong and risk the tested keyboard logic. Native `<select>`s
  (type filters, direction/cadence) are native form controls — keep them native. Use `<Menu>`/
  `<Popover>` only where the surface is *genuinely* a menu of actions/links or a popover of
  controls.

**Interaction feedback.** The shared **`.tap-press`** token (`index.css`) is the app-wide
premium tap-feedback: a subtle `active:scale` springing back via `transition-transform`,
**framer-free + universal** (button / link / NavLink), so the rollout drops it onto any
button by adding one class. The **`<Button>`** primitive (`shared/components/Button.tsx`)
bakes it in (variants: `primary` / `secondary` / `ghost` / `danger`; first real consumers:
the recurring + beneficiaries page CTAs); the TopNav main `NavLink`s apply the raw class.
The **bell** rings (a framer rotate wobble) on first paint, on hover/focus, and on a
periodic beat while unseen. Reduced motion neutralizes all of it.

**The `.tap-press` rule (T-nav-ia-reorg #6 — adopt app-wide).** Every **standalone
click target** carries `.tap-press` (directly, or via `<Button>`): buttons, icon
buttons, dropdown triggers (e.g. SearchableSelect's chevron/clear), tab buttons, and
standalone link-CTAs (`<Link>` / `<NavLink>` styled as an action — add `inline-block`
so the `transform` actually applies; inline elements ignore it). **Two exceptions:**
(1) **inline text links inside prose** — a scale nudges the surrounding words and inline
elements don't transform cleanly; (2) **dropdown option rows** — they fire on
`mousedown`, so the press-scale never renders and the highlight already gives feedback.
New feature work wires this in as it adds interactive controls.

Out of scope for the scaffold: route/step **transitions** (AnimatePresence) — see
`motion-rollout-appwide.md`.

## Week convention

Locked 2026-05-28. **Weeks are ISO 8601 — Monday
through Sunday — in the user's active timezone.** Applies to every
frontend surface that buckets data by week: the Tax Tracker
current-week card, every Dashboard week widget, the
`/transactions` calendar view, the bills generation picker, and
anything added later that needs a week boundary.

**Canonical helper:** `features/taxation/api/billPeriod.ts` →
`weekRangeInTz(date, tz)` returns
`{ period_start: <Mon YYYY-MM-DD>, period_end: <Sun YYYY-MM-DD> }`.
Never roll your own Monday math; use the helper so a future
convention change is one file. `fractionOfWeekElapsed` and
`precedingWeekStartInTz` also operate on ISO weeks.

**Naming.** Use `weekStart` / `weekEnd` (or `period_start` /
`period_end` when matching backend payload shape) — never
`mondayStart` / `sundayEnd`. The labels stay neutral so the next
convention change (if any) doesn't require a rename sweep.
