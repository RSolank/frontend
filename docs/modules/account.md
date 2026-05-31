# Account surface

> The five-section user-management area at `/account/*` — profile,
> security, privacy, accessibility, preferences. Lives at
> [`src/features/account/`](../../src/features/account/).

## Purpose

- Reorganize the user-related surface from a monolithic ProfilePage
  into a multi-section area with a shared layout + sidebar, mirroring
  the Settings shell.
- Separate **frontend-persisted accessibility prefs** (theme / zoom /
  motion / privacy-mask) from **backend-persisted preferences**
  (currency / country / timezone / future defaults), each on its own
  section, per [`docs/conventions.md`](../conventions.md) "Accessibility vs Preferences"
  contract.
- Give security knobs (password, recovery question, future active
  sessions) their own focused surface.

## Pages

| Path | Component | Content |
|---|---|---|
| `/account` | redirect → `/account/profile` | — |
| `/account/profile` | `pages/AccountProfilePage.tsx` | name, dob, email (read-only), contact |
| `/account/security` | `pages/AccountSecurityPage.tsx` | change password, security question, active-sessions placeholder |
| `/account/privacy` | `pages/AccountPrivacyPage.tsx` | placeholder (data export / deletion / retention — needs backend) |
| `/account/accessibility` | `pages/AccountAccessibilityPage.tsx` | theme / zoom / reduce-motion / privacy-mask |
| `/account/preferences` | `pages/AccountPreferencesPage.tsx` | country / currency / timezone + defaults placeholder |
| `/profile` | redirect → `/account/profile` | legacy alias |

## Shell

[`components/AccountLayout.tsx`](../../src/features/account/components/AccountLayout.tsx)
wraps
[`shared/components/SectionedPageLayout`](../../src/shared/components/SectionedPageLayout.tsx)
with the five-section spec — same primitive that backs the
[Settings shell](settings.md).

## Routes

[`account.routes.tsx`](../../src/features/account/account.routes.tsx)
exports `accountRoutes`. Children are lazy-imported so the
metadata-heavy Profile + Preferences pages keep their own chunks.
Every page is auth-gated by the parent `<ProtectedRoute>` wrap.

## Section notes

### Profile

Submits a partial PATCH to `/api/users/me` carrying only
`first_name`, `last_name`, `dob`, `contact`. The dial-code default
derives from the persisted `user.contact` prefix; users can override
the dial code in the input (e.g. when their phone is from a different
country than residence).

### Preferences

After BE Phase 1.9 the page Save fans out two parallel PATCHes —
`PATCH /api/users/me` carrying `{ country }` (identity slice) and
`PATCH /api/users/preferences` carrying `{ currency, timezone }`
(the preferences row's `currency` + `timezone` columns). On save,
invalidates `userKeys.all` and runs `hydratePreferences()` so
[`usePreferencesStore`](../../src/shared/state/preferences.store.ts)
reflects the new values immediately — every `formatMoney` /
`formatDate` call across the app stays in sync.

A "Defaults" card points users at `/account/accessibility` for the
date format / number format / default landing route / default
debit-credit / underline-links / focus-ring-always controls. All
six are server-synced via the same `user_preferences` row (see
[CONTRIBUTING.md §5](../../CONTRIBUTING.md#data-fetching--server-state)
"User preferences contract") — `hydratePreferences()` writes to
their stores at boot, and `subscribeToPreferenceStores()` PATCHes
back on every user-driven `setX()`.

### Security

Change password POSTs `/api/auth/change-password`. Security question
POSTs `/api/auth/recovery` (one question per user, replaces the
previous choice). The "Active sessions" placeholder card flags the
backend follow-up — the `user_sessions` table exists, but no
list/revoke endpoint is exposed yet.

### Privacy

Pure placeholder until backend endpoints exist for data export +
account deletion + retention windows. Points users at the
**privacy mask** under Accessibility for in-app amount blurring
today.

### Accessibility

Canonical edit surface for the ten frontend-persisted UX prefs.
Each control subscribes to a Zustand store with `persist`
middleware — the first four are shared with the
[`AccessibilityPopover`](../../src/shared/components/AccessibilityPopover.tsx)
(desktop) and the mobile drawer's Accessibility section, so a
toggle in either surface updates this page live and vice versa.

**Display & motion (seven paint-time controls):**

| Setting | Store | Bridge / effect |
|---|---|---|
| Theme (light/dark/system) | [`useThemeStore`](../../src/shared/state/theme.store.ts) | `applyTheme` mirrors mode to `<html class="dark">`. No-FOUC inline script in `index.html`. |
| Text size (zoom) | [`useZoomStore`](../../src/shared/state/zoom.store.ts) | `applyZoom` sets `<html>` fontSize. |
| Reduce motion | [`useMotionStore`](../../src/shared/state/motion.store.ts) | `applyMotion` toggles `.reduce-motion` on `<html>`. |
| Privacy mask | [`usePrivacyStore`](../../src/shared/state/privacy.store.ts) | `applyPrivacyMask` toggles `.mask-amounts` on `<html>`; CSS blurs elements with `.money` class. |
| High contrast | [`useContrastStore`](../../src/shared/state/contrast.store.ts) | `applyContrast` toggles `.high-contrast` on `<html>`; CSS boosts secondary text + border + accent contrast. |
| Underline links | [`useLinkUnderlineStore`](../../src/shared/state/linkUnderline.store.ts) | `applyLinkUnderline` toggles `.underline-links` on `<html>`; CSS forces `text-decoration: underline` on every `<a>`. WCAG 1.4.1. |
| Always show focus | [`useFocusRingStore`](../../src/shared/state/focusRing.store.ts) | `applyFocusRing` toggles `.focus-always` on `<html>`; CSS forces `:focus` outline regardless of `:focus-visible`. |

**Data formatting (three format-time controls):**

| Setting | Store | Effect |
|---|---|---|
| Date format | [`useDateFormatStore`](../../src/shared/state/dateFormat.store.ts) | `formatDate` / `formatDateTime` in `shared/utils/dateUtils.ts` read the store via `getState()` and pass the resolved locale + opts to `Intl.DateTimeFormat`. Pass `respectUserFormat: false` to opt out (e.g. a calendar widget that needs a fixed shape). |
| Number / currency separator | [`useNumberFormatStore`](../../src/shared/state/numberFormat.store.ts) | `formatMoney` in `shared/utils/currency.ts` reads the store and keys its `Intl.NumberFormat` cache by mode. |
| Default landing route | [`useLandingRouteStore`](../../src/shared/state/landingRoute.store.ts) | `useAuth.login` and `LoginPage` (already-authed redirect) call `getLandingRoute()` and navigate there. Defaults to `/dashboard` for first-time / unset visitors. |

**All ten persist in `localStorage` only — they do NOT follow the
user across devices** (Zustand `persist` middleware, one
`localStorage` key per store). To make any of them sync, the
backend needs a column on `UserProfile` and the corresponding
hydrate path; see "Backend follow-ups deferred" in
[`docs/archive/refactor-v1.0/summary.md`](../archive/refactor-v1.0/summary.md).

The contrast / underline / focus toggles are page-only for now —
the AccessibilityPopover stays compact (the original four). If
usage surfaces a need we can lift them later.

## TopNav integration

The user dropdown in
[`shared/components/TopNav.tsx`](../../src/shared/components/TopNav.tsx)
stays at "Profile + Sign Out" — Profile links to `/account/profile`,
and the sectioned-page sidebar inside `/account/*` exposes the other
four sections. The mobile-drawer Profile row points at the same URL.

## API surface (consumed)

The account surface owns no API hooks itself — every request goes
through the [`users`](users.md) feature's `api/`:

| Method + path | Used by |
|---|---|
| `GET /api/users/me` | Profile + Preferences hydrate |
| `PATCH /api/users/me` | Profile save (partial), Preferences save (partial) |
| `GET /api/users/preferences` | Post-save hydration of `usePreferencesStore` |
| `POST /api/auth/change-password` | Security |
| `GET /api/auth/recovery` | Security (current question) |
| `POST /api/auth/recovery` | Security (set/replace question) |

## Tests

| File | Covers |
|---|---|
| `account.routes.test.tsx` | `/account` index redirect, `/profile` legacy redirect, sidebar exposes all five sections at canonical hrefs |
| `pages/AccountProfilePage.test.tsx` | `/me` hydration, partial-PATCH shape (no preferences fields), phone validation |
| `pages/AccountPreferencesPage.test.tsx` | `/me` hydration, partial-PATCH shape (no profile fields), `usePreferencesStore` re-hydration post-save, Defaults placeholder visibility |
| `pages/AccountSecurityPage.test.tsx` | Password Update gated on validity, security-question hydrate, Active-sessions placeholder visibility |
| `pages/AccountAccessibilityPage.test.tsx` | All ten controls (7 Display & motion + 3 Data formatting) render |
| Store smoke tests | `shared/state/{contrast,linkUnderline,focusRing,dateFormat,numberFormat,landingRoute}.store.test.ts` — toggle / setter + `apply*` class mirror where applicable |
| Helper override paths | `shared/utils/dateUtils.test.ts` — `formatDate` honors `useDateFormatStore`; `shared/utils/currency.test.ts` — `formatMoney` honors `useNumberFormatStore` |
| `pages/AccountPrivacyPage.test.tsx` | Placeholder card + cross-link to Accessibility |
