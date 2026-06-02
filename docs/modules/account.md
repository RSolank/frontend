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
| `/account/profile` | `pages/AccountProfilePage.tsx` | profile-image picker, name, dob, email (read-only), contact |
| `/account/security` | `pages/AccountSecurityPage.tsx` | change password, change email, security question, active sessions list + revoke |
| `/account/privacy` | `pages/AccountPrivacyPage.tsx` | privacy mask pointer, data export, danger zone (delete account) |
| `/account/accessibility` | `pages/AccountAccessibilityPage.tsx` | theme / zoom / reduce-motion / privacy-mask |
| `/account/preferences` | `pages/AccountPreferencesPage.tsx` | country / currency / timezone + defaults placeholder |
| `/profile` | redirect → `/account/profile` | legacy alias |
| `/account/cancel-deletion` | `pages/CancelDeletionPage.tsx` (UNAUTH) | landing for the deletion-cancel email link + apiClient `ACCOUNT_PENDING_DELETION` 403 interceptor |
| `/account/revoke-device` | `pages/RevokeDevicePage.tsx` (UNAUTH) | landing for the new-device intimation email's "this wasn't me" CTA — auto-POSTs `/api/v1/auth/new-device/revoke {token}` on mount (BE Phase 2.3) |

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

Submits a partial PATCH to `/api/v1/users/me` carrying only
`first_name`, `last_name`, `dob`, `contact`. The dial-code default
derives from the persisted `user.contact` prefix; users can override
the dial code in the input (e.g. when their phone is from a different
country than residence).

A "Profile picture" card at the top of the page hosts the
[`<ProfileImagePicker>`](../../src/features/account/components/ProfileImagePicker.tsx)
— preview + Upload + Remove + a 4/6-col grid of geometric presets
backed by BE Phase 1.13's `/api/v1/users/profile-image-presets`. Each
mutation invalidates `userKeys.me()` so the new `profile_image_url`
propagates instantly to the TopNav avatar (which goes through the
shared `<ProfileImage>` primitive in `shared/components/`).

A "Your account at a glance" stats card
([`<UserStatsCard>`](../../src/features/account/components/UserStatsCard.tsx))
renders below the profile form. Reads BE Phase 1.15's
`GET /api/v1/users/me/stats` (member-since, last-active, txn count,
beneficiaries added, active recurring count); falls back to a
friendly hidden state when the route 404s.

### Preferences

After BE Phase 1.9 the page Save fans out two parallel PATCHes —
`PATCH /api/v1/users/me` carrying `{ country }` (identity slice) and
`PATCH /api/v1/users/preferences` carrying `{ currency, timezone }`
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

A "Taxation" card surfaces the `auto_enabled` toggle (BE Phase 2.6,
Decision 26 — Auto-finalize weekly bills). Same hydrate / subscribe
pipeline as the other preferences; toggle is the shared
`<TaxModeToggle>` component. When OFF, bills stay in ACCRUING for
visibility and the user drives generation manually from the Tax
Tracker. When the BE stale-bill worker EXPIREs unpaid bills past
`STALE_BILL_THRESHOLD`, this flag flips off server-side — the
hydrate path catches that on the next boot/refresh.

### Security

Change password POSTs `/api/v1/auth/change-password`. Security question
POSTs `/api/v1/auth/recovery` (one question per user, replaces the
previous choice).

**Two-factor authentication** — `<TwoFactorSection>` (BE Phase 2.7).
Three flow states managed by a `FlowState` discriminator:

1. **idle** — reads `meData.user.two_factor_enabled` to render
   either the Enable CTA (off) or the Enabled-with-Disable card
   (on). Treats absent `two_factor_enabled` as false (the BE
   hasn't surfaced the flag on /me yet; the 409 from `/2fa/enroll`
   is the authoritative signal).
2. **enrolling** — `/2fa/enroll` returned a staged secret +
   provisioning URI. The panel shows the base32 secret prominently
   for manual authenticator entry and an `otpauth://` deep link
   that mobile authenticators register. (A proper QR render is
   queued as polish — bundle headroom is at 0.73 kB so a QR
   library would punch the §3 ceiling.) Submitting a 6-digit code
   POSTs `/2fa/verify-enroll`.
3. **showing-backup-codes** — verify-enroll returned 10 one-time
   backup codes. Panel renders them in a 2- / 3-column grid + a
   Download button (text-file blob). Code visibility is one-shot;
   the BE only returns hashes — no regenerate endpoint.

Disable lives behind a `<Modal size="sm">` that re-confirms with
the password (BE step-up). The undo / regenerate of backup codes is
intentionally out of scope (no BE endpoint).

**Change email** is 2FA-aware via the same `meData.user.two_factor_enabled`
read: when on, the code field renders unconditionally in step 1.
The existing 401-reveal fallback (form starts without the code field,
adds it on a 401) covers the case where /me doesn't surface the flag
yet — both paths converge on the same form shape.

**Trusted devices** — `<TrustedDeviceList>` (BE Phase 2.3,
T-new-device-otp). Lists every device that has cleared the
emailed-OTP gate (`GET /api/v1/auth/devices`). Each row shows the
parsed UA label, first / last seen timestamps, and a "This device"
chip on the row whose `is_current === true`. Forgetting a device
DELETEs it (cascades the active session if any) and forces re-
verification on the next sign-in from that device. Lives next to
Active sessions on `/account/security`.

**Change email** — `<EmailChangeForm>` runs the two-step BE Phase 2.8
flow: step 1 POSTs `/api/v1/auth/change-email-request {new_email,
password, code?}` and the BE emails an OTP to the new address +
a security notice to the current address; step 2 POSTs the OTP to
`/api/v1/auth/change-email-confirm` for an atomic dual-column swap.
The form omits `code` initially and reveals the 2FA-code field
defensively on the first 401 (the FE doesn't yet have a /me
`two_factor_enabled` signal — that lands with T-2fa-enroll FE
wiring). 409/429 on confirm are terminal per the spec → restart
from step 1. On success, invalidates `userKeys.me()` and surfaces
the "other devices were signed out" notice.

**Active sessions** — `<SessionList>` reads the BE Phase 1.12
`GET /api/v1/auth/sessions` endpoint. Each row carries a UA-derived
device label ("Chrome on macOS" / "Safari on iOS"), IP, last-active
timestamp in the user's tz, a "This device" badge on the row backing
the current request, and a Revoke button. ConfirmDialog gates the
revoke; current-device revoke uses stronger copy. Mutations
invalidate `authKeys.sessions()` (30s staleTime). The session list
also benefits from BE Phase 1.4 — the `X-Device-Id` header sent by
apiClient since Platform FE Batch 3 sharpens the device fingerprint
so the same phone on a new network doesn't show as two rows.

### Privacy

**Privacy controls card** — pointer to the privacy mask under
Accessibility for in-app amount blurring.

**Export data** — `<DataExportPanel>` lists the 8 BE-exposed
resources (transactions, beneficiaries, tax-bills, tax-details,
spend-by-tag, spend-by-merchant, bank-accounts, profile) backed by
BE Phase 1.10's `GET /api/v1/exports/{resource}?format=csv|json`. CSV
streams with `Content-Disposition: attachment`; the FE fetches with
the bearer header (anchor `download` can't carry headers), reads the
response as a blob, and clicks an off-DOM link. CSV / JSON toggle is
a pill control.

**Danger zone** — `<DangerZone>` schedules the user's account for
deletion via BE Phase 2.1's `POST /api/v1/users/me/delete {password}`.
Confirms via a password-modal, hard-logouts on success (drops tokens
+ navigates to `/` with a sessionStorage banner cue). 403 surfaces
inline as "Incorrect password". The companion
[`CancelDeletionPage`](../../src/features/account/pages/CancelDeletionPage.tsx)
(unauth, mounted on `/account/cancel-deletion`) handles the email
link's `?token=` + the apiClient `ACCOUNT_PENDING_DELETION` 403
interceptor that hard-logouts + redirects any other tab still in
the grace window.

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
goes through the shared `<ProfileImage>` primitive — same indigo
monogram fallback as the pre-Batch-5 button when
`user.profile_image_url` is `null`, the BE-served WEBP when it's
set. The Account link points at `/account/profile`; the
sectioned-page sidebar inside `/account/*` exposes the other four
sections. The mobile-drawer Profile row points at the same URL.
The accessibility toggle panel is lazy-loaded — both
`AccessibilityPopover` and the mobile drawer Suspense-import
[`<AccessibilityPanel>`](../../src/shared/components/AccessibilityPanel.tsx).

## API surface (consumed)

The account surface owns no API hooks itself — every request goes
through the relevant feature's `api/`:

| Method + path | Used by |
|---|---|
| `GET /api/v1/users/me` | Profile + Preferences hydrate; carries `profile_image_url` |
| `PATCH /api/v1/users/me` | Profile save (partial), Preferences save (partial: country only after Batch 2) |
| `GET /api/v1/users/me/stats` | Profile — UserStatsCard ("Your account at a glance") |
| `GET /api/v1/users/preferences` | Hydration of every preference store |
| `PATCH /api/v1/users/preferences` | Preferences save (currency, timezone slice) |
| `GET /api/v1/users/profile-image-presets` | Profile picture picker grid |
| `PUT /api/v1/users/me/profile-image/preset` | Profile picture preset selection |
| `POST /api/v1/users/me/profile-image` | Profile picture upload (multipart) |
| `DELETE /api/v1/users/me/profile-image` | Profile picture remove |
| `POST /api/v1/users/me/delete` | Danger zone scheduled deletion |
| `POST /api/v1/users/me/delete/cancel` | Cancel-deletion page (unauth) |
| `POST /api/v1/auth/change-password` | Security — change password |
| `POST /api/v1/auth/change-email-request` | Security — change email step 1 |
| `POST /api/v1/auth/change-email-confirm` | Security — change email step 2 |
| `GET /api/v1/auth/sessions` | Security — active sessions list |
| `DELETE /api/v1/auth/sessions/{id}` | Security — revoke session |
| `GET /api/v1/auth/devices` | Security — TrustedDeviceList |
| `DELETE /api/v1/auth/devices/{uid}` | Security — forget device |
| `POST /api/v1/auth/2fa/enroll` | Security — TwoFactorSection enrol step 1 |
| `POST /api/v1/auth/2fa/verify-enroll` | Security — TwoFactorSection enrol step 2 (returns backup codes) |
| `POST /api/v1/auth/2fa/disable` | Security — TwoFactorSection disable (password step-up) |
| `POST /api/v1/auth/new-device/revoke` | RevokeDevicePage (unauth) |
| `GET /api/v1/auth/recovery` | Security (current question) |
| `POST /api/v1/auth/recovery` | Security (set/replace question) |
| `GET /api/v1/exports/{resource}` | Privacy — data export |

## Tests

| File | Covers |
|---|---|
| `account.routes.test.tsx` | `/account` index redirect, `/profile` legacy redirect, sidebar exposes all five sections at canonical hrefs |
| `pages/AccountProfilePage.test.tsx` | `/me` hydration, partial-PATCH shape (no preferences fields), phone validation |
| `pages/AccountPreferencesPage.test.tsx` | `/me` hydration, partial-PATCH shape (no profile fields), `usePreferencesStore` re-hydration post-save, Defaults placeholder visibility |
| `pages/AccountSecurityPage.test.tsx` | Password Update gated on validity, security-question hydrate, Active-sessions card mounted |
| `components/SessionList.test.tsx` | Row rendering + "This device" badge, confirm-then-revoke removes row, current-device stronger copy, empty state |
| `components/EmailChangeForm.test.tsx` | Happy-path two-step flow + sign-out notice, 401 reveals 2FA field, 409 inline on request, 409 on confirm restarts from step 1 |
| `shared/components/ProfileImage.test.tsx` | Image / monogram rendering, initials fallbacks (first+last / first-only / email), shared indigo background |
| `components/DataExportPanel.test.tsx` | 8 resources rendered, format toggle drives the query string, non-OK surfaces inline |
| `pages/AccountAccessibilityPage.test.tsx` | All ten controls (7 Display & motion + 3 Data formatting) render |
| Store smoke tests | `shared/state/{contrast,linkUnderline,focusRing,dateFormat,numberFormat,landingRoute}.store.test.ts` — toggle / setter + `apply*` class mirror where applicable |
| Helper override paths | `shared/utils/dateUtils.test.ts` — `formatDate` honors `useDateFormatStore`; `shared/utils/currency.test.ts` — `formatMoney` honors `useNumberFormatStore` |
| `pages/AccountPrivacyPage.test.tsx` | Privacy controls + Danger Zone cards present, modal opens, 403 (wrong password) surfaces inline |
| `components/TwoFactorSection.test.tsx` | idle → enrolling → showing-backup-codes flow, Disable modal password step-up, /2fa/enroll error handling |
| `components/TrustedDeviceList.test.tsx` | Lists `/api/v1/auth/devices`, "This device" chip on `is_current`, forget-device DELETE removes row |
| `components/UserStatsCard.test.tsx` | Renders the 5 stat tiles from `/api/v1/users/me/stats`; hidden state when the endpoint 404s |
| `pages/RevokeDevicePage.test.tsx` | Auto-POSTs on mount with valid token (204 → success copy); 400 → invalid-token copy; no-token landing explains the email link |
