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
- [**Accessibility vs Preferences**](#accessibility-vs-preferences) — device a11y toggle vs backend-persisted preference.
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
- **Color discipline.** A restrained neutral palette + one accent + a
  small set of semantic colors (success, warning, error, info). Defined
  once in Tailwind's `@theme` block, referenced everywhere; no ad-hoc
  hex values inside components.
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
    (e.g. "Hello, *firstname*" greeting, breadcrumbs) get
    `hidden sm:inline` / `hidden md:flex` so the icon row stays
    uncrowded on narrow screens. Don't ship a hamburger pattern until
    a screen genuinely needs it.
  - **Per-surface responsibility** — check every surface you build at
    `sm` (375 px), `md` (768 px), and a desktop width before shipping it.
  - **Effort tiers by surface density.** The *check* is always per
    batch; the *implementation work* scales with what the feature
    actually contains:
    - **Form / list / chip surfaces** (auth pages, profile, tags,
      beneficiaries, settings): usually a 5-minute viewport smoke
      test — open at 375 px and desktop, click around, fix anything
      visibly broken. Often nothing needs to change; record the
      check in the handoff and move on.
    - **Table, grid, multi-step, and dense surfaces** (transactions
      list, statement upload, taxation bills, budget grids,
      Dashboard, statement-parse review tables): require deliberate
      responsive design *upfront* — pick the degradation strategy
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
    list views, detail pages). Modals are for *secondary, focused
    actions* — anything that would also work as "open in a new tab"
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
2. The user is allowed to *add* new values to that same list.

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
  - **Single-select:** the chosen value lives *inside* the search
    input — pick replaces the search text with the value's label;
    the dropdown closes; the parent is responsible for caching the
    chosen id alongside the visible name. No chip rail.
    Reference: `BeneficiarySearch`.
  - **Multi-select:** every pick appends a chip to a rail rendered
    *below* the input. Chips carry a `×` remove button. Already-
    selected ids are filtered out of the dropdown so the same
    value can't be re-picked.
    Reference: `TagSelector`, categorization-rules tag picker.
  - **Feature-specific chip enrichment** (e.g. "Primary" badge +
    "Set Primary" buttons on categorization-rule tag chips, alias
    bracket display on beneficiary chips) is allowed on top of the
    multi-select base. It's a *layer over* the pattern, not a
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

| Surface | Convention | Reason |
|---|---|---|
| Beneficiary picker (Add Tx, Categorization Rules) | `SearchableList` (pick-or-create) | Data-driven, user can add |
| Tag picker on Add Tx | `SearchableList` (pick-or-create, multi) | Data-driven, user can add |
| Tag dropdown in Filter Sidebar | `SearchableSelect` | Data-driven, often > 15 |
| Merchant search bar (Transactions filter row) | bespoke (per-feature `MerchantSearchBar`) | Filter-row chrome, not a sidebar dropdown |
| Country picker (Register, Profile) | `SearchableSelect` | 250 items |
| Currency picker (Profile, Preferences) | `SearchableSelect` | 170 items |
| Timezone picker (Register, Profile) | bespoke `TimezoneSelect` (country-narrowing) | Specialised filter cascade |
| Month dropdown (Transactions filter) | plain `<select>` | Sequential, 25 items, native jump works |
| Type filter (debit/credit/all) | pill toggle | 3 items — toggle, not dropdown |
| Sort field / direction (Filter Sidebar) | plain `<select>` | ≤ 4 items, fixed |
| Date format / number format pickers | plain `<select>` | ≤ 10 items, semantic groups |

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
- `features/categorization` — rule edit modal.
- `features/taxation` — `TaxationRuleFormDialog` for rules,
  `BillDetailDialog` for bills (read-only DetailModal — bills
  aren't edited, only viewed + paid).

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
- **Icon-only, sized 32×32.** Matches the close X chrome. Rose tint
  (`text-rose-600 dark:text-rose-400` with `hover:bg-rose-50 /
  dark:hover:bg-rose-950/40`) differentiates from the close X
  without dominating the header.
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

| Modal | Status | Notes |
|---|---|---|
| `BudgetFormDialog` | ✅ | Modal is the primary delete surface (no row-level delete on the cards). |
| `BeneficiaryFormDialog` | ✅ | Row + modal both available. |
| `TagFormDialog` | ✅ | Row + modal. Hidden when `editingTag` is a system tag (`created_by === null` or `=== SYSTEM_USER_ID`). |
| Transactions edit modal | ✅ | Gated on `editingTxn.source === 'manual'` — statement-imported txns can't be deleted (matches the row-dropdown gate). |
| `TaxationRuleFormDialog` | ❌ skip | Canonical 4 txn_types are system rows; "customize vs fall back to default" is the model, not "delete". |
| `BillDetailDialog`, `GenerateBillsDialog`, `MergeBeneficiariesDialog`, `AuthModal` | ❌ skip | View-only or action surfaces; nothing to delete. |

**Shared infra:** `shared/components/Modal.tsx` exposes a
`headerActions?: React.ReactNode` slot rendered between the title
block and the close X. Future modals that need a destructive header
action consume this slot — no new infra per surface.

**System / restricted entities:** when a class of entities can't
be deleted (system tags, locked rows, etc.), the parent omits
`onRequestRemove` in the form dialog and the icon doesn't render.
Avoids the disabled-button-with-tooltip pattern that suggests "you
might be able to do this later" — the action is genuinely absent.

## Row highlight on save

Locked 2026-05-26. **Every list
page that hosts add / edit modals briefly highlights the row that
was just created or saved.** The intent is to neutralize the
surprise of a modal closing into a re-rendered list — the user's
eye lands on the changed row instead of scanning the table.

**Anchor invariants:**

- Highlight kicks in on **both create AND edit** success, not just
  edit. Symmetric UX: every save → glow.
- Visual: **indigo ring** that fades after ~1500 ms. Use
  `ring-2 ring-indigo-500 ring-inset` (or equivalent), conditional
  on `highlightId === row.id`.
- **Best-effort, no scrolling.** If the user has filtered or
  sorted the row out of view, the highlight still fires but the
  user may not see it. Don't auto-scroll — surprise scrolling is
  worse than a missed highlight.
- The highlight **does not block subsequent interactions** —
  clicking another row, opening another modal, or sorting the
  list cancels the timer cleanly.
- **One timer, one row at a time.** Triggering the highlight on a
  new row cancels the previous timer.

**Shared hook:** `shared/hooks/useRowHighlight.ts` returns
`{ id, flash }`. Callers wire `flash(id)` into the modal's
`onSaved` and compare `id === row.id` in row className. Reference
implementations: `BeneficiariesPage`, `TagsPage`,
`TransactionsPage`. (`CategorizationRulesPage` has a feature-
specific variant that also handles group rebucket-and-expand on
top of the base highlight; it predates the shared hook and is
left in place.)

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
  full SoT set is: currency, timezone, date_format, number_format,
  landing_route, default_txn_kind, underline_links,
  focus_ring_always. **Note:** underline-links and focus-ring-
  always *are* a11y flags by behaviour (they affect contrast /
  visible focus) but live in Preferences because the right value
  is a property of the *user*, not the *device* — a user who needs
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

