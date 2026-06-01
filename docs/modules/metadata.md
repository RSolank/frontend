# Metadata — dissolved into `shared/`

> **This is no longer a feature.** Metadata had no UI of its own and was
> consumed by ~15 files across 6 features (currency symbol for
> `formatMoney`, the region pickers), so it lives in `shared/` as the
> cross-cutting reference-data infrastructure it always was:
> - reference-data queries → [`src/shared/api/referenceData.ts`](../../src/shared/api/referenceData.ts)
>   (`useCountriesQuery`, `useCurrenciesQuery`, `useTimezonesQuery`)
> - pickers → [`src/shared/components/`](../../src/shared/components/)
>   (`CountrySelect`, `CurrencySelect`, `TimezoneSelect`)
>
> The system-constants endpoint (`/api/metadata/constants`) stays a
> tag-local query (`features/tags/api/queries.ts`). The backend may
> follow by reclassifying its `metadata` module as a core service. The
> rest of this page is retained as historical reference.

## Purpose

- Cache and expose the `/api/metadata/{countries,currencies,timezones,constants}`
  surface through React Query so feature pages mount their dropdowns
  instantly after the first fetch.
- Provide composable form controls (`CountrySelect`, `CurrencySelect`,
  `TimezoneSelect`) used by every page that asks the user for region
  preferences (Register, Profile, future onboarding screens).

## Pages

None — metadata is a supporting feature, not a routed surface.

## Components

[`shared/components/`](../../src/shared/components/) — `CountrySelect.tsx`,
`CurrencySelect.tsx`, `TimezoneSelect.tsx`

| Component | Purpose |
|---|---|
| `CountrySelect.tsx` | `<select>` over the countries list. Options render as `(${country_code}) ${name}` (e.g. `(+91) India`) so the dial-code prefix that drives the phone input is visible at a glance; falls back to just `${name}` when the metadata row lacks a dial code. `onChange(value, country)` exposes the full `CountryOption` so callers sync dial code / currency / timezone in one render. Renders the "Rather not say" sentinel by default; opt-out with `allowPreferNotSay={false}`. Reads from `useCountriesQuery()`, or accepts a pre-loaded `countries={...}` array for pages that already fetched the data. Exports `formatCountryOption(c)` for callers that need the label outside the dropdown. |
| `CurrencySelect.tsx` | `<select>` over the currencies list. Options render as `${label} (${symbol})` (e.g. `INR - Indian Rupee (₹)`) — the backend `label` already carries the `CODE - Name` shape; the trailing symbol makes the choice unambiguous for users who don't recognise every ISO code. Falls back to just `${label}` when the metadata row's `symbol` is `null`. Exports `formatCurrencyOption(c)` for callers that need the label outside the dropdown. |
| `TimezoneSelect.tsx` | Three-mode timezone picker. Country known + single tz → read-only display with "Use a different timezone" override. Country known + multiple tzs → country-scoped dropdown sourced from the `CountryOption.timezones` array. Unknown country / explicit override → full IANA list from `useTimezonesQuery()` defaulted to `getBrowserTimezone()`. After BE Phase 1.3 the data comes entirely from the backend — no npm `countries-and-timezones` dependency. |

All three use the shared `.form-input` class from `src/index.css`.

## API

Consolidated into one file —
[`shared/api/referenceData.ts`](../../src/shared/api/referenceData.ts):

| Exports |
|---|
| `fetchCountries`, `fetchCurrencies`, `fetchTimezones`, `useCountriesQuery`, `useCurrenciesQuery`, `useTimezonesQuery`; types `CountryOption` + `CurrencyOption` + `TimezoneOption`. Cache keys (`referenceDataKeys`) are file-internal — no shared keys constant for downstream consumers. |

The `/api/metadata/constants` endpoint is fetched separately by
`features/tags/api/queries.ts` (`fetchTagConstants`).

All three queries set `staleTime: 60 * 60 * 1000` (one hour) because
metadata is reference data — it changes between deploys, not between
page navigations.

**Server shapes after BE Phase 1.3:**

- `CountryOption.timezones: string[]` — multi-tz countries (US 5,
  RU 11, AU 8, BR 4) return the full IANA set; single-tz countries
  return a one-element list. Singular `timezone` field retired.
- `TimezoneOption` — `{ name, offset_winter?, offset_summer? }`. The
  offset pair is advisory (FE renders the live offset via
  `Intl.DateTimeFormat` — see
  `shared/utils/countryTimezones.ts:getTimezoneOffsetLabel`); the
  static values exist for SSR / non-Intl callers.

## State

No Zustand stores. Cached data lives in the TanStack Query cache
keyed by `metadataKeys`; staleness is the only cache control.

## Tests

| File | Covers |
|---|---|
| `components/CountrySelect.test.tsx` | Emits `(value, country)` on selection; emits `(_, null)` for the prefer-not-say sentinel; hides the sentinel option when disabled |
| `components/CurrencySelect.test.tsx` | `${code} (${symbol})` rendering with symbol fallback; `onChange` emits the code; `formatCurrencyOption` is a pure helper |
| `components/TimezoneSelect.test.tsx` | Read-only / country-scoped / fallback modes |

`src/test/handlers/metadata.ts` serves the three endpoints with
sample data; tests override via `server.use(...)` for edge cases.

## Cross-feature consumers

- **`features/auth/pages/RegisterPage.tsx`** — uses `CountrySelect` +
  `CurrencySelect` + `TimezoneSelect`. Passes pre-loaded data into the
  selects because the page already fetches countries + currencies in
  one parallel call (locale-defaulting needs the list before the user
  touches the dropdown).
- **`features/account/pages/AccountProfilePage.tsx`** +
  **`AccountPreferencesPage.tsx`** — same three components. Reads
  `countries` from `useCountriesQuery()` directly so the country-
  driven `dialCode` sync useEffect has access to the matched
  `CountryOption`.

## Backend follow-ups (queued)

Both of the original refactor-era follow-ups for this feature have
shipped:

1. ~~`/api/metadata/countries` should return `timezones: List[str]`.~~
   Shipped in BE Phase 1.3 (`a89ebfc`); FE wired in Platform FE
   Batch 4. `TimezoneSelect` now reads `country.timezones` directly;
   `getTimezonesForCountryName` became a thin pure helper that takes
   the metadata payload as input. The npm `countries-and-timezones`
   dependency was dropped.
2. ~~Profile schema: persist `timezone`.~~ Shipped in BE Phase 1.9
   on the new `user_preferences` row; FE wired in Platform FE
   Batch 2 (`hydratePreferences()` + Account Preferences page Save
   PATCHes `/api/users/preferences {currency, timezone}`).
