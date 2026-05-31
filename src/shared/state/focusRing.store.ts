import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility flag — focus indicators today are gated behind
// `:focus-visible`, which the browser hides on mouse-click activation.
// Keyboard-first users (and screen-reader users navigating with
// arrows) benefit from the indicator on every interaction. When ON,
// the app forces a visible outline on `:focus` regardless of input
// modality.
//
// Server-synced after BE Phase 1.9 — the `user_preferences` row's
// `focus_ring_always` column is the SoT. Hydrated at boot by
// `hydratePreferences()` and PATCHed back on user-driven setX by
// `subscribeToPreferenceStores()` (see CONTRIBUTING.md §5). Belongs
// to *Preferences*, not the device-Accessibility cluster
// (docs/conventions.md → "Accessibility vs Preferences") — a user
// who needs a visible focus ring on their laptop needs it on their
// phone too. Zustand `persist` (`localStorage["focus-ring"]`) is the
// local cache that bridges between cold-boot and the GET response.

interface FocusRingState {
  alwaysVisible: boolean;
  setAlwaysVisible: (next: boolean) => void;
  toggle: () => void;
}

export const useFocusRingStore = create<FocusRingState>()(
  persist(
    (set, get) => ({
      alwaysVisible: false,
      setAlwaysVisible: (next) => set({ alwaysVisible: next }),
      toggle: () => set({ alwaysVisible: !get().alwaysVisible }),
    }),
    { name: 'focus-ring' }
  )
);

export function applyFocusRing(alwaysVisible: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(
    'focus-always',
    alwaysVisible
  );
}
