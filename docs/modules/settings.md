# Settings shell

> Composes the three settings surfaces (categories, categorization
> rules, taxation rules) under a single `/settings/*` URL space with a
> shared sidebar + breadcrumb. Lives at
> [`src/features/settings/`](../../src/features/settings/).

## Purpose

- Give every configuration screen a consistent navigation chrome —
  breadcrumb on top, sidebar (≥lg) or horizontal-scroll tab row
  (<lg) listing every section.
- Move category + categorization-rule URLs under `/settings/` so the
  full settings surface is bookmarkable as a single deep-link tree.
- Provide a growth path: new settings sections slot in as another
  sidebar item with no shell rework — Bank Accounts joined this way
  in Batch 13 without any layout changes.

## Pages

The settings feature owns no pages of its own — it composes pages that
live in their owning feature module:

| Path                             | Component                         | Owning feature                                                          |
| -------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `/settings`                      | redirect → `/settings/beneficiaries` | —                                                                    |
| `/settings/beneficiaries`        | `BeneficiariesPage`               | [`features/beneficiaries/`](../../src/features/beneficiaries/) (T-nav-ia-reorg) |
| `/settings/recurring`            | `RecurringPage`                   | [`features/recurring/`](../../src/features/recurring/) (T-nav-ia-reorg) |
| `/settings/categories`           | `TagsPage`                        | [`features/tags/`](../../src/features/tags/)                            |
| `/settings/categorization-rules` | `CategorizationRulesPage`         | [`features/categorization/`](../../src/features/categorization/)        |
| `/settings/taxation-rules`       | `TaxationRulesPage`               | [`features/taxation/`](../../src/features/taxation/)                    |
| `/settings/bank-accounts`        | `BankAccountsPage`                | [`features/bankAccounts/`](../../src/features/bankAccounts/) (Batch 13) |

The pre-Batch-9 `/categories` and `/categorization-rules` URLs are
**retired** — no `<Navigate>` redirects, no route entries. A repo-wide
grep confirmed no in-app surface links to them (the TopNav SETTINGS
dropdown, the mobile-drawer SETTINGS section, and the old husk
`SettingsPage` index all migrated to `/settings/*` in this batch).
External bookmarks fall through the root `*` catch-all and render the
branded 404 page (`app/pages/NotFound.tsx`) inside the App shell — the
same UX as any other unknown URL (see
[architecture.md](../architecture.md) Routing model).

Beneficiaries + Recurring were both re-homed into this shell from the
MAIN nav row in T-nav-ia-reorg (declutter pass — the main row keeps only
the four primary surfaces: Transactions · Expense Tracker · Tax Tracker ·
Savings). Beneficiaries leads the sidebar and is the `/settings` index
default; Recurring sits second. Both carry heavy cross-feature
deep-linking, so in-app links now target their `/settings/*` URLs — the
transaction-row payee link opens `/settings/beneficiaries?edit=<id>`, and
the transaction `RecurringChip` opens `/settings/recurring?template=<id>`.
The old top-level `/beneficiaries` and `/recurring` routes were removed
outright — clean replacement, no redirect (external bookmarks fall
through the `*` catch-all to the branded 404, as with every retired URL
above).

## Shell

[`components/SettingsLayout.tsx`](../../src/features/settings/components/SettingsLayout.tsx)
is a thin wrapper around
[`shared/components/SectionedPageLayout`](../../src/shared/components/SectionedPageLayout.tsx)
that supplies the section spec. The same primitive backs the
Account shell (see [`docs/modules/account.md`](account.md)) — write
once, two consumers.

The shell breadcrumb reads `Settings › *Active Section*` on every
viewport. Desktop renders a sticky sidebar in a 2-column layout;
mobile / tablet renders a horizontal-scrolling tab row pinned under
the breadcrumb.

## Routes

[`settings.routes.tsx`](../../src/features/settings/settings.routes.tsx)
exports `settingsRoutes`. The parent route mounts `<SettingsLayout />`
and its `<Outlet />` renders the active child. `protectedRoutes()` in
[`app/routes.tsx`](../../src/app/routes.tsx) wraps the parent's
element in `<ProtectedRoute>`; children inherit protection through
the gated outlet.

Children are lazy-imported so each tab keeps its independent code-split
chunk — the shell adds zero bundle cost to the initial paint.

## TopNav integration

[`shared/components/TopNav.tsx`](../../src/shared/components/TopNav.tsx)'s
Settings dropdown (desktop) and mobile-drawer SETTINGS section both
list the same four sections (Categories, Categorization Rules,
Taxation Rules, Bank Accounts) at their `/settings/*` paths. The
active route paints an indigo bottom border in the main-nav row.

## Tests

| File                                             | Covers                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `settings.routes.test.tsx`                       | `/settings` index redirect, legacy URL redirects, sidebar links resolve to canonical `/settings/*` paths |
| `shared/components/SectionedPageLayout.test.tsx` | Breadcrumb tail, sidebar + tab nav parity, `<Outlet />` content rendering                                |
| `shared/components/TopNav.test.tsx`              | Drawer Settings section href assertions                                                                  |
