import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Personalization — picks where the user lands immediately after a
// successful login (and what the top-bar Home icon points at, if we
// want it consistent later).
//
// Server-synced after BE Phase 1.9 — the `user_preferences` row's
// `landing_route` column is the SoT. Hydrated at boot by
// `hydratePreferences()` and PATCHed back on user-driven setX by
// `subscribeToPreferenceStores()` (see CONTRIBUTING.md §5).
// Zustand `persist` (`localStorage["landing-route"]`) is the local
// cache that bridges between cold-boot and the GET response.

export type LandingRoute =
  | '/dashboard'
  | '/transactions'
  | '/budgets'
  | '/consumption-tax';

interface LandingRouteState {
  route: LandingRoute;
  setRoute: (route: LandingRoute) => void;
}

export const useLandingRouteStore = create<LandingRouteState>()(
  persist(
    (set) => ({
      route: '/dashboard',
      setRoute: (route) => set({ route }),
    }),
    { name: 'landing-route' }
  )
);

// Imperative read for non-React callers (auth login flow lives in a
// query mutation handler). Reads the persisted store directly without
// subscribing.
export function getLandingRoute(): LandingRoute {
  return useLandingRouteStore.getState().route;
}
