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
