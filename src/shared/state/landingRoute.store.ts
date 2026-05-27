import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility / personalization — picks where the user lands
// immediately after a successful login (and what the top-bar Home
// icon points at, if we want it consistent later).
//
// Frontend-only (Zustand `persist` ⇒ `localStorage["landing-route"]`)
// by design. Does NOT follow the user across devices. Backend has no
// `default_landing_route` column today; when it lands, hydration
// extends `hydratePreferences()` with one extra setter. Until then
// this is on-device only.

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
