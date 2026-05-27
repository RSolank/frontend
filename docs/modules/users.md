# Users feature

> Mirrors `backend/app/modules/users`. As of Batch 9 this feature
> ships **no pages of its own** — the Profile UI was split into the
> [Account surface](account.md) at `/account/*`. The feature still
> owns the `/api/users/me` and `/api/users/preferences` API hooks
> (plus a couple of `/api/auth/*` helpers exclusively consumed by the
> account pages). Lives at
> [`src/features/users/`](../../src/features/users/).

## Purpose

- Own the `/api/users/me` and `/api/users/preferences` query surface
  consumed by both the [account pages](account.md) (for editing) and
  the auth flow (for boot-time + post-login hydration).
- Hold the canonical `userKeys` cache-key factory so any mutation
  across the app can invalidate the user query graph with one key.
- Expose the `/api/auth/change-password` and `/api/auth/recovery`
  mutation helpers — they live under the auth backend prefix but are
  consumed only by `AccountSecurityPage`, so the helper placement
  follows the calling page rather than the URL prefix.

## State

The users feature holds no Zustand state. The two account-adjacent
stores live in `shared/state/` because `shared/api/apiClient.ts`
reads from them:

- [`useAuthStore`](../../src/shared/state/auth.store.ts) — the user
  object the header / nav reads from after `refreshAuthUser()`
  populates it.
- [`usePreferencesStore`](../../src/shared/state/preferences.store.ts)
  — rewritten on Preferences save via `hydratePreferences()`. Headers
  + every `formatMoney` / `formatDate` call observe the change.

## API

[`api/`](../../src/features/users/api/)

| File | Exports |
|---|---|
| `keys.ts` | `userKeys` — `all`, `me()`, `preferences()` |
| `schemas.ts` | `profileFormSchema`, `changePasswordSchema`, `setRecoveryQuestionSchema`, server-shape `ProfileUpdatePayload` (every field optional — pages PATCH partial payloads) |
| `queries.ts` | `fetchCurrentUser`, `fetchUserPreferences`, `fetchRecoveryQuestions`, `useCurrentUserQuery`, `useUserPreferencesQuery` |
| `mutations.ts` | `updateProfileRequest`, `changePasswordRequest`, `setRecoveryQuestionRequest` |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/users/me` | `AccountProfilePage` + `AccountPreferencesPage` hydrate, `refreshAuthUser` (auth boot) |
| `PATCH /api/users/me` | `AccountProfilePage` save (partial), `AccountPreferencesPage` save (partial) |
| `GET /api/users/preferences` | `hydratePreferences` (auth boot + post-login + post-Preferences-save) |
| `GET /api/auth/recovery` | `AccountSecurityPage` |
| `POST /api/auth/recovery` | `AccountSecurityPage` |
| `POST /api/auth/change-password` | `AccountSecurityPage` |

## Cross-feature seams

- **`features/auth/state/useAuth.ts`** imports `fetchCurrentUser` +
  `fetchUserPreferences` from this feature's `queries.ts`. The auth
  flow drives hydration; the queries belong here so a profile
  mutation can invalidate them through the canonical `userKeys.all`
  namespace.
- **`features/account/pages/AccountProfilePage`** and
  **`AccountPreferencesPage`** both call
  `queryClient.invalidateQueries({ queryKey: userKeys.all })` after a
  successful save. Preferences additionally re-runs
  `hydratePreferences()` so `usePreferencesStore` reflects the new
  currency / timezone in the same tick.

## Tests

The users feature itself has no pages and therefore no page tests.
The behavior the feature backs is covered by the consuming features:

| Coverage | Test file |
|---|---|
| `GET /api/users/me` hydration | [`features/account/pages/AccountProfilePage.test.tsx`](../../src/features/account/pages/AccountProfilePage.test.tsx), [`features/account/pages/AccountPreferencesPage.test.tsx`](../../src/features/account/pages/AccountPreferencesPage.test.tsx) |
| `PATCH /api/users/me` partial payloads | Same |
| `hydratePreferences` round-trip | `AccountPreferencesPage.test.tsx` |
| `/api/auth/change-password` validation | [`features/account/pages/AccountSecurityPage.test.tsx`](../../src/features/account/pages/AccountSecurityPage.test.tsx) |
| `/api/auth/recovery` hydrate | Same |
| Login-time + boot-time preferences hydration | [`features/auth/pages/LoginPage.test.tsx`](../../src/features/auth/pages/LoginPage.test.tsx) |

`src/test/handlers/users.ts` exposes GET + PATCH `/api/users/me` and
GET `/api/users/preferences` permissively; individual tests override
via `server.use(...)` to assert request bodies.
