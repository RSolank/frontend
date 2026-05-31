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

- `api/keys.ts` — react-query keys (`authKeys.me()`, `authKeys.constants()`,
  `userKeys.preferences()`).
- `api/schemas.ts` — Zod schemas for login / register / recovery inputs.
  `registerFormSchema` shapes the RHF form state; `RegisterPayload`
  shapes the wire body sent to `/api/auth/register` (`timezone` field
  included; see CONTRIBUTING.md §5 + the "Backend follow-ups deferred"
  section of `docs/archive/refactor-v1.0/summary.md`).
- `api/queries.ts` — `useCurrentUserQuery`, `useUserPreferencesQuery`,
  plus imperative `fetchCurrentUser` / `fetchUserPreferences` used by
  `state/useAuth.ts`.
- `api/mutations.ts` — bare `apiFetch` wrappers for every auth endpoint
  (`loginRequest`, `registerRequest`, `logoutRequest`,
  `recoveryQuestionRequest`, `forgotPasswordRequest`, `verifyOtpRequest`,
  `verifyAnswerRequest`, `resetPasswordFinalRequest`).

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
- **Timezone default** comes from the selected country's `timezone`
  field on the metadata payload, or — when the country is unknown — from
  `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Timezone field UI** is driven by
  `shared/utils/countryTimezones.ts`, a thin wrapper around the
  `countries-and-timezones` npm package. The wrapper exists so the
  swap to a backend-sourced timezones list (see the implementation
  plan's "Backend follow-ups") is a one-file change.

## Tests

- `shared/state/auth.store.test.ts` — store contract (setters, reset).
- `shared/utils/countryTimezones.test.ts` — Intl.DisplayNames + package
  lookups.
- `features/auth/pages/LoginPage.test.tsx` — login submit + preferences
  hydration + recovery entry.
- `features/auth/pages/RegisterPage.test.tsx` — country/timezone default,
  payload shape (timezone included), password gate.
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

`app/pages/Home.tsx` lazy-imports `AuthModal` so the ~30 KB
`countries-and-timezones` dep stays in the auth chunk rather than the
first-paint bundle.

### Session-expiry redirect contract

- Helper `shared/utils/sessionRedirect.ts → unauthenticatedRedirect()`
  is the single source of truth used by `<ProtectedRoute>` and the
  unknown-path catch-all.
- Has access OR refresh token → **/login** (session expired).
- No tokens → **/** (true unauthenticated visitor or post-logout).
- `apiClient`'s 401-then-refresh-fail path lands on `/login` (matches
  case 1 by construction).
- `useAuth.logout()` clears tokens and navigates to `/` (case 2).
