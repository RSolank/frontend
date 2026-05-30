import {
  sanitizePreferences,
  usePreferencesStore,
} from '../../../shared/state/preferences.store';

import { fetchUserPreferences } from './queries';

// Hydrate `usePreferencesStore` from `/api/users/preferences`. Best-effort:
// a failure (404 / network / unauthorized) leaves the store at whatever
// values it already had — the headers still go on the wire, just with
// USD/UTC defaults if nothing was set. See CONTRIBUTING.md §5.
//
// Lives in the users feature's api/ (it reads the user's own
// preferences) rather than in auth — auth's boot flow + the account
// preferences page both call it, so users/api is the sanctioned
// cross-feature surface. The preferences *store* it writes to is in
// shared/ (the wire-header source); the *fetch* is users-owned.
export async function hydratePreferences(): Promise<void> {
  try {
    const prefs = await fetchUserPreferences();
    // sanitizePreferences applies the printable-ASCII filter (so a
    // legacy backend row with currency="₹" can't poison the store and
    // break every subsequent fetch) and the missing/null → defaults
    // coercion in one step.
    usePreferencesStore.getState().setPreferences(sanitizePreferences(prefs));
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('hydratePreferences failed', err);
    }
  }
}
