import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Mirrors the backend's UserPreferencesMiddleware contract — see
// CONTRIBUTING.md §5 "User preferences contract". Every authenticated
// request injects these as `x-user-currency` / `x-user-timezone` headers
// (handled in shared/api/apiClient.ts). Defaults match the middleware's
// fallbacks (USD / UTC) so an unhydrated store still produces valid
// requests.
//
// Must live in shared/ because shared/api/apiClient.ts reads from it;
// per the dependency direction rule (features → shared, never the
// reverse) it cannot live in features/users/state/.

export interface UserPreferences {
  currency: string;
  country: string | null;
  timezone: string;
}

export interface PreferencesState extends UserPreferences {
  setPreferences: (prefs: UserPreferences) => void;
  reset: () => void;
}

export const PREFERENCES_DEFAULTS: UserPreferences = {
  currency: 'USD',
  country: null,
  timezone: 'UTC',
};

// HTTP header values must be ISO-8859-1 (char codes 0–255); we tighten
// to printable ASCII (0x20–0x7E) so a stray currency symbol (e.g. "₹"
// at U+20B9 — observed 2026-05-25 from a legacy data row) can't be
// promoted into a header where `fetch()` would throw and take down
// every subsequent request.
export function isHeaderSafe(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

// Coerce a server-shaped preferences payload into a store-shaped one,
// falling back to PREFERENCES_DEFAULTS for any field that's missing,
// null, or non-header-safe. Used by:
// - features/auth/state/useAuth.ts:hydratePreferences (entry point that
//   could otherwise poison the store with a bad backend value)
// - shared/api/apiClient.ts:preferenceHeaders (last-line defence so
//   even an in-memory poisoned store can't break the wire)
// Permissively typed so the server response shape
// (`{currency?: string | null; country?: string | null; timezone?: string | null}`)
// drops in without a cast.
export interface RawPreferences {
  currency?: string | null;
  country?: string | null;
  timezone?: string | null;
}

export function sanitizePreferences(
  input: RawPreferences | null | undefined
): UserPreferences {
  const src = input ?? {};
  return {
    currency: isHeaderSafe(src.currency)
      ? src.currency
      : PREFERENCES_DEFAULTS.currency,
    country:
      typeof src.country === 'string' && src.country.length > 0
        ? src.country
        : PREFERENCES_DEFAULTS.country,
    timezone: isHeaderSafe(src.timezone)
      ? src.timezone
      : PREFERENCES_DEFAULTS.timezone,
  };
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...PREFERENCES_DEFAULTS,
      setPreferences: (prefs) => set({ ...prefs }),
      reset: () => set({ ...PREFERENCES_DEFAULTS }),
    }),
    { name: 'user-preferences' }
  )
);
