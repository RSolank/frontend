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
- `recovery/components/RecoveryFlow.tsx` — multi-step forgot-password UI
  (email → choice → question / OTP → reset).
- `../metadata/components/TimezoneSelect.tsx` — single / multi / unknown
  timezone selector built early in Batch 2 because Register needs it;
  Batch 3 reuses it in Profile.

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
  included; see CONTRIBUTING.md §5 + the "Backend follow-ups" section
  of `docs/refactor/implementation_plan.md`).
- `api/queries.ts` — `useCurrentUserQuery`, `useUserPreferencesQuery`,
  plus imperative `fetchCurrentUser` / `fetchUserPreferences` used by
  `state/useAuth.ts`.
- `api/mutations.ts` — bare `apiFetch` wrappers for every auth endpoint
  (`loginRequest`, `registerRequest`, `logoutRequest`,
  `recoveryQuestionRequest`, `forgotPasswordRequest`, `verifyOtpRequest`,
  `verifyAnswerRequest`, `resetPasswordFinalRequest`).

## User-preferences hydration

Per CONTRIBUTING.md §5: every authenticated request injects
`x-user-currency` and `x-user-timezone` headers from `usePreferencesStore`.
This feature owns the hydration entry points:

- **Login success** — `useAuth.login()` calls `hydratePreferences()` →
  `GET /api/users/preferences` → `usePreferencesStore.setPreferences(...)`.
- **App boot (token already present)** — `AuthInit` calls
  `refreshAuthUser()` + `hydratePreferences()` from a single `useEffect`.
- **Logout** — `useAuth.logout()` calls `usePreferencesStore.reset()`
  back to USD / UTC defaults.

Profile updates (Batch 3) will invalidate
`userKeys.preferences()` and call `setPreferences(...)` so changes
propagate without a reload.

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
- `features/metadata/components/TimezoneSelect.test.tsx` — single /
  multi / unknown branches + override expansion.
- `shared/components/ProtectedRoute.test.tsx` — unchanged behaviour
  against `useAuthStore` instead of the old context.

MSW handlers live at
[`src/test/handlers/{auth,users,metadata}.ts`](../../src/test/handlers/)
with permissive defaults; tests override via `server.use(...)` to
assert error paths.

## Batch 6.5 — hybrid auth + extracted form components

The form bodies moved out of `pages/LoginPage.tsx` and
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
