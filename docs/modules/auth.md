# Auth feature

> Mirrors `backend/app/modules/auth`. Owns login, registration, the
> forgot-password recovery flow, and the boot-time auth-state
> hydration. Lives at [`src/features/auth/`](../../src/features/auth/).

## Purpose

- Authenticate users against `/api/auth/login` and `/api/auth/register`.
- Drive the forgot-password recovery flow (security question and / or
  OTP, then `reset-password-final`).
- Hydrate `useAuthStore` and `usePreferencesStore` at app boot so the
  rest of the app sees the authenticated user + their currency / tz
  preferences immediately.

## Pages

| Path | Component | Notes |
|---|---|---|
| `/login` | `pages/LoginPage.tsx` | Bears the recovery flow inline via `recovery/components/RecoveryFlow.tsx` |
| `/register` | `pages/RegisterPage.tsx` | Includes timezone field + locale-driven country default |
| `/verify/2fa` | `pages/VerifyTwoFactorPage.tsx` | BE Phase 2.7 — TOTP / backup-code entry. Reached via `navigate('/verify/2fa', { state: { pending_token } })` from `useAuth.login` when the BE returns `{status:"two_factor_required"}` and from the recovery flow on the same shape. Submits to `/api/auth/2fa/login-verify` to finalize the session. |
| `/verify/new-device` | `pages/VerifyNewDevicePage.tsx` | BE Phase 2.3 — OTP entry for an unknown-device login. Reached via `navigate('/verify/new-device', { state: { pending_token, masked_email } })` from `useAuth.login`. Submission delegates to `useAuth.verifyNewDevice`, which chain-routes to `/verify/2fa` when the BE returns a 2FA challenge (device gate is step 1 for 2FA-enabled users) and otherwise persists tokens + navigates to the landing route. Resend button POSTs `/api/auth/new-device/resend` and swaps the in-state `pending_token` with the new one. |
| `/account/revoke-device?token=…` | `features/account/pages/RevokeDevicePage.tsx` | BE Phase 2.3 — public landing for the one-click revoke link from the new-device intimation email. Auto-fires `POST /api/auth/new-device/revoke {token}` on mount; renders Success / Invalid / Error / no-token panels. Lives in `publicRoutes` (unauthenticated by design — the user is presumed locked out of the device they're revoking). |

Routes are exported from
[`features/auth/auth.routes.tsx`](../../src/features/auth/auth.routes.tsx)
and composed into the root router by `src/app/routes.tsx`. Each route
carries an `errorElement` that resolves to
`features/auth/components/AuthErrorFallback.tsx`.

## Components

- `components/AuthInit.tsx` — mounted once inside the root `<App />`.
  Fires the boot-time `refreshAuthUser()` + `hydratePreferences()`.
- `components/AuthErrorFallback.tsx` — per-route `errorElement`.
- `components/AuthErrorNotice.tsx` — shared error surface for Login /
  Register / RecoveryFlow. Renders the plain `form-error` div for
  ordinary failures and live-ticks a "Try again in N seconds" message
  when the auth store carries a `retryAfterSeconds` value (see
  "Rate-limit + device-block UX" below).
- `recovery/components/RecoveryFlow.tsx` — multi-step forgot-password UI
  (email → choice → question / OTP → reset).
- `shared/components/TimezoneSelect.tsx` — single / multi / unknown
  timezone selector; used by Register and by the account Profile form.

## State

- `useAuthStore` lives at
  [`src/shared/state/auth.store.ts`](../../src/shared/state/auth.store.ts)
  (not in `features/auth/state/`) because `shared/components/ProtectedRoute`
  subscribes to it — same dependency-direction rationale as
  `usePreferencesStore`.
- `features/auth/state/useAuth.ts` — drop-in replacement for the legacy
  `useAuth()` hook. Returns `{user, constants, loading, error, setError,
  login, register, logout, refreshUser}` so the other feature batches'
  pages keep working unchanged until their own batch moves them.

## API

- `api/keys.ts` — react-query keys (`authKeys.all`, `authKeys.constants()`,
  `authKeys.sessions()`).
- `api/schemas.ts` — Zod schemas for login / register / recovery inputs.
  `registerFormSchema` shapes the RHF form state; `RegisterPayload`
  shapes the wire body sent to `/api/auth/register` (`timezone` field
  included; see CONTRIBUTING.md §5 + the "Backend follow-ups deferred"
  section of `docs/archive/refactor-v1.0/summary.md`).
- `api/queries.ts` — `useCurrentUserQuery`, `useUserPreferencesQuery`,
  plus imperative `fetchCurrentUser` / `fetchUserPreferences` used by
  `state/useAuth.ts`.
- `api/queries.ts` — `useSessionsQuery` + `SessionInfo` shape for
  the Account → Security sessions list (BE Phase 1.12).
- `api/mutations.ts` — bare `apiFetch` wrappers for every auth endpoint
  (`loginRequest`, `registerRequest`, `logoutRequest`,
  `recoveryQuestionRequest`, `forgotPasswordRequest`, `verifyOtpRequest`,
  `verifyAnswerRequest`, `resetPasswordFinalRequest`,
  `revokeSessionRequest`, `changeEmailRequestStart`,
  `changeEmailConfirmRequest`). Login + recovery returns are typed
  as a `LoginResponse` discriminated union (`TokenResponse` vs
  `TwoFactorRequiredChallenge` vs `NewDeviceChallenge` — see
  "Polymorphic login response" below).
- `api/twoFactor.ts` — BE Phase 2.7 TOTP wrappers
  (`enrollTwoFactorRequest`, `verifyEnrollTwoFactorRequest`,
  `disableTwoFactorRequest`, `loginVerifyTwoFactorRequest`).
- `api/newDevice.ts` — BE Phase 2.3 new-device-OTP wrappers
  (`verifyNewDeviceRequest`, `resendNewDeviceOtpRequest`,
  `revokeNewDeviceRequest`, `fetchKnownDevices`,
  `revokeKnownDeviceRequest`). `VerifyNewDeviceResponse` is the
  tighter `TokenResponse | TwoFactorRequiredChallenge` union since
  a successful verify never returns another new-device challenge.

## Polymorphic login response (BE Phase 2.3 + 2.7)

`POST /api/auth/login` and `POST /api/auth/reset-password-final` can
now return three shapes — all as 200 OK responses, NOT errors:

1. `TokenResponse` (`{access_token, refresh_token}`) — the happy path.
2. `{status: "two_factor_required", pending_token}` — BE Phase 2.7
   challenge for 2FA-enabled users.
3. `{status: "new_device_verification_required", pending_token,
   masked_email}` — BE Phase 2.3 challenge for unknown-device logins.

`useAuth.login()` discriminates on `status` via the narrowing
helpers in `api/mutations.ts` (`isTwoFactorChallenge`,
`isNewDeviceChallenge`) and routes:

| Discriminator | Routes to | Carries via `location.state` |
|---|---|---|
| `two_factor_required` | `/verify/2fa` | `pending_token` |
| `new_device_verification_required` | `/verify/new-device` | `pending_token` + `masked_email` |
| (no status) | landing-route preference | tokens persisted, prefs hydrated |

`useAuth.loginVerify2fa(pending_token, code)` finishes the 2FA
challenge with a POST to `/api/auth/2fa/login-verify` and applies
the same post-login flow as a non-2FA login (persist + hydrate +
navigate to the landing route).

`useAuth.verifyNewDevice(pending_token, otp)` finishes the new-
device challenge with a POST to `/api/auth/new-device/verify`.
Response is polymorphic — TokenResponse on the happy path, or a
`{status:"two_factor_required", pending_token}` chain-through
when the user has 2FA on (device gate was step 1). The chain-
through routes to `/verify/2fa` with the NEW pending_token; the
FE never opens a session until tokens land.

Recovery (`RecoveryFlow`'s `handleFinalReset`) carries the same
discriminator — a 2FA-enabled user who recovers their password
saves the new password BE-side and then routes to `/verify/2fa`
exactly like a normal login. Recovery no longer bypasses 2FA;
backup codes are the escape hatch if the authenticator is lost.

## Rate-limit + device-block UX

The backend rate-limits hot auth routes (BE Phase 1.8, `auth.rate-limit`)
and blocks devices after repeated failed logins (BE Phase 1.4,
`auth.devices`). Both surface the same FE shape:

- **`X-Device-Id`** — `shared/utils/deviceId.ts` mints a UUID v4 on first
  read and persists it to `localStorage["pba.device_id"]`. `apiFetch`
  attaches it to every request (and to the unauthenticated
  `POST /auth/refresh`) so the BE's device-lockout + suspicious-refresh
  paths can distinguish "same browser, expired token" from "stolen
  token replay from a new device". Backend is forward-compatible —
  absent the header it falls back to a UA + client-hints + IP
  composite.
- **`Retry-After` envelope** — when the BE returns a 429 (rate-limited)
  or 403 (device-blocked), `apiFetch` parses the `Retry-After` header
  (delta-seconds or HTTP-date) and attaches `retryAfterSeconds: number`
  to the thrown `ApiError`.
- **`useAuthStore.retryAfterSeconds`** — `useAuth.login()` /
  `register()` and the RecoveryFlow's `readError` write the parsed
  value into the auth store. Cleared on the next input change or on
  the next attempt.
- **`<AuthErrorNotice action=… />`** — subscribes to
  `retryAfterSeconds`, runs the value through
  [`useRetryCountdown`](../../src/shared/hooks/useRetryCountdown.ts)
  for the live tick, and renders "Too many *login* attempts. Please
  try again in *N* seconds." The same component renders the plain
  `error` string when `retryAfterSeconds` is null, so every auth form
  has one error surface.
- **`formatRetryAfter`** in `useRetryCountdown.ts` picks the coarsest
  unit that fits (seconds → minutes → hours, rounded up) so long
  device-blocks don't display as a four-digit second count.

This is the only rate-limit-aware surface in the app today; for
non-auth 429s the apiClient still attaches `retryAfterSeconds` to the
thrown error so callers *can* handle it, but no other feature renders
the countdown — failed-query screens use their generic error path.

## User-preferences hydration

Per CONTRIBUTING.md §5: the backend's `user_preferences` row is the
SoT for currency, timezone, and the six other server-synced
preference fields. This feature owns the hydration entry points:

- **Login success** — `useAuth.login()` calls `hydratePreferences()`
  → `GET /api/users/preferences` → writes every recognized field
  into its store.
- **Register success** — `useAuth.register()` calls
  `hydratePreferences()` so the BE-seeded defaults (derived from
  the registration `country`) reach the FE before the post-register
  redirect.
- **App boot (token already present)** — `AuthInit` calls
  `refreshAuthUser()` + `hydratePreferences()` from a single
  `useEffect`.
- **Logout** — `useAuth.logout()` calls `usePreferencesStore.reset()`
  back to USD / UTC defaults. The other six stores keep their last
  value (cold-boot cache); the next login's hydrate overwrites them
  with the new user's row.

Profile updates invalidate `userKeys.preferences()` and call
`setPreferences(...)` so changes propagate without a reload.

## Register form: country / locale / timezone defaulting

- **Country default** uses `Intl.DisplayNames(['en'], {type: 'region'})`
  to resolve the browser's locale region (e.g. `en-IN` → `IN` → `India`)
  and matches against `/api/metadata/countries`. Falls back to India
  when nothing matches.
- **Timezone default** comes from the first entry of the selected
  country's `timezones` array on the metadata payload, or — when the
  country is unknown — from
  `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Timezone field UI** is driven by `<TimezoneSelect>` which reads
  the country list from `useCountriesQuery` and the full IANA list
  from `useTimezonesQuery` — both served by the backend's
  `/api/metadata/*` endpoints after BE Phase 1.3.
  `shared/utils/countryTimezones.ts` now holds only the pure helpers
  (`getTimezonesForCountryName(name, countries)`, offset formatting,
  browser-tz fallback); the npm `countries-and-timezones` package was
  retired in Platform FE Batch 4.

## Tests

- `shared/state/auth.store.test.ts` — store contract (setters, reset).
- `shared/utils/countryTimezones.test.ts` — Intl.DisplayNames +
  metadata-payload lookups (`getTimezonesForCountryName(name, countries)`).
- `features/auth/pages/LoginPage.test.tsx` — login submit + preferences
  hydration + recovery entry.
- `features/auth/pages/RegisterPage.test.tsx` — country/timezone default,
  payload shape (timezone included), password gate.
- `features/auth/pages/VerifyTwoFactorPage.test.tsx` — TOTP / backup-code
  entry, `pending_token` carry-over from `location.state`, error states.
- `features/auth/pages/VerifyNewDevicePage.test.tsx` — new-device OTP
  entry, resend flow swapping the in-state `pending_token`, 2FA chain-
  through routing to `/verify/2fa`.
- `features/auth/recovery/components/RecoveryFlow.test.tsx` — recovery
  step machine (email → choice → question / OTP → reset), 2FA chain-
  through on successful reset.
- `shared/components/TimezoneSelect.test.tsx` — single /
  multi / unknown branches + override expansion.
- `shared/components/ProtectedRoute.test.tsx` — unchanged behaviour
  against `useAuthStore` instead of the old context.

MSW handlers live at
[`src/test/handlers/{auth,users,metadata}.ts`](../../src/test/handlers/)
with permissive defaults; tests override via `server.use(...)` to
assert error paths.

## Hybrid auth + extracted form components

The form bodies live outside `pages/LoginPage.tsx` and
`pages/RegisterPage.tsx` into shared
`components/LoginForm.tsx` + `components/RegisterForm.tsx`. The page
wrappers shrink to thin shells; the same forms also mount inside
`components/AuthModal.tsx`, which `app/pages/Home.tsx` lazy-loads on Sign
In / Register CTA clicks. Switching between login and register inside
the modal does not close it.

`app/pages/Home.tsx` lazy-imports `AuthModal` so the auth form bodies
(plus the metadata pickers they mount) stay in the auth chunk rather
than the first-paint bundle. With BE Phase 1.3 serving the IANA list,
the heavy `countries-and-timezones` npm dependency that used to
inflate that chunk is gone.

### Session-expiry redirect contract

- Helper `shared/utils/sessionRedirect.ts → unauthenticatedRedirect()`
  is the single source of truth used by `<ProtectedRoute>` and the
  unknown-path catch-all.
- Has access OR refresh token → **/login** (session expired).
- No tokens → **/** (true unauthenticated visitor or post-logout).
- `apiClient`'s 401-then-refresh-fail path lands on `/login` (matches
  case 1 by construction).
- `useAuth.logout()` clears tokens and navigates to `/` (case 2).
