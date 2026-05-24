# Users feature

> Mirrors `backend/app/modules/users`. Owns the authenticated user's
> profile surface — personal info, password change, security question.
> Lives at [`src/features/users/`](../../src/features/users/).

## Purpose

- Render the `/profile` page where users edit their personal data,
  currency / timezone preferences, and account-security settings.
- Own the `/api/users/me` and `/api/users/preferences` query surface
  consumed by both the Profile page (for editing) and the auth flow
  (for boot-time + post-login hydration).
- Drive currency / timezone changes through the
  [`usePreferencesStore`](../../src/shared/state/preferences.store.ts)
  contract — the store mirrors the backend's `UserPreferencesMiddleware`
  inputs (see [CONTRIBUTING.md §5](../../CONTRIBUTING.md#user-preferences-contract-currency--timezone)).

## Pages

| Path | Component | Notes |
|---|---|---|
| `/profile` | `pages/ProfilePage.tsx` | Profile + change password + security question, all on one screen. Lazy-loaded via `users.routes.tsx`. |

Routes are exported from
[`features/users/users.routes.tsx`](../../src/features/users/users.routes.tsx)
and composed into the root router by `src/app/routes.tsx` (`<Profile>`
is wrapped by `protectedRoutes()`). The route lazy-imports
`ProfilePage` so the `countries-and-timezones` graph (~14 KB gz) used by
`TimezoneSelect` ships in a separate chunk instead of the initial bundle.

## Components

- `pages/ProfilePage.tsx` — orchestrates the three forms (profile,
  password, security question). Mounts the metadata selects
  (`CountrySelect`, `CurrencySelect`, `TimezoneSelect`) from
  `features/metadata/components/`.

## State

The users feature itself holds no Zustand state — every store lives in
`shared/state/` because shared/api needs to read them:

- `useAuthStore` (`shared/state/auth.store.ts`) — the user object the
  header / nav reads from after `refreshAuthUser()` populates it.
- `usePreferencesStore` (`shared/state/preferences.store.ts`) —
  rewritten on profile save via `hydratePreferences()`. Headers + every
  `formatMoney` / `formatDate` call observe the change.

## API

[`api/`](../../src/features/users/api/)

| File | Exports |
|---|---|
| `keys.ts` | `userKeys` — `all`, `me()`, `preferences()` |
| `schemas.ts` | `profileFormSchema`, `changePasswordSchema`, `setRecoveryQuestionSchema`, server-shape `ProfileUpdatePayload` |
| `queries.ts` | `fetchCurrentUser`, `fetchUserPreferences`, `fetchRecoveryQuestions`, `useCurrentUserQuery`, `useUserPreferencesQuery` |
| `mutations.ts` | `updateProfileRequest`, `changePasswordRequest`, `setRecoveryQuestionRequest` |

Endpoints touched:

| Method + path | Used by |
|---|---|
| `GET /api/users/me` | `ProfilePage` load, `refreshAuthUser` (auth boot) |
| `PATCH /api/users/me` | `ProfilePage` save |
| `GET /api/users/preferences` | `hydratePreferences` (auth boot + post-login + post-profile-save) |
| `GET /api/auth/recovery` | `ProfilePage` security-question section |
| `POST /api/auth/recovery` | `ProfilePage` security-question save |
| `POST /api/auth/change-password` | `ProfilePage` change-password form |

Note that the `/api/auth/recovery` + `/api/auth/change-password`
endpoints live under the auth prefix on the backend but are consumed
exclusively by the Profile page, so the mutation helpers live here in
`features/users/api/mutations.ts` rather than in `features/auth/api/`.
The endpoint stays addressable by either feature; the helper placement
follows the page that uses it.

## Cross-feature seams

- **`features/auth/state/useAuth.ts`** imports `fetchCurrentUser` +
  `fetchUserPreferences` from `features/users/api/queries.ts`. This is
  intentional: the auth flow drives hydration, but the queries belong
  to the users feature so a profile mutation can invalidate them
  through the canonical `userKeys.all` namespace. See Batch 3's
  "Composition" notes in the implementation plan for the rationale.
- **`ProfilePage`** uses TanStack Query's `queryClient.invalidateQueries({ queryKey: userKeys.all })`
  after a successful save, then re-runs `hydratePreferences()` so the
  `usePreferencesStore` reflects the new currency / timezone in the
  same tick.

## Tests

| File | Covers |
|---|---|
| `pages/ProfilePage.test.tsx` | Hydration from `/api/users/me`, PATCH body shape (timezone included), post-save preferences hydration, password-rules validation |

`src/test/handlers/users.ts` exposes GET + PATCH `/api/users/me` and
GET `/api/users/preferences` permissively; individual tests override
via `server.use(...)` to assert request bodies.
