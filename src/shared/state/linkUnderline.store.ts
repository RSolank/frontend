import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility flag — when ON, every `<a>` element gets
// `text-decoration: underline` so links are distinguishable from
// surrounding text by shape, not just color (WCAG 1.4.1). The app's
// links currently rely on indigo color alone to signal interactivity;
// users with color-vision differences can flip this on for an
// unmistakable link cue.
//
// Server-synced after BE Phase 1.9 — the `user_preferences` row's
// `underline_links` column is the SoT. Hydrated at boot by
// `hydratePreferences()` and PATCHed back on user-driven setX by
// `subscribeToPreferenceStores()` (see CONTRIBUTING.md §5). Belongs
// to *Preferences*, not the device-Accessibility cluster
// (docs/conventions.md → "Accessibility vs Preferences") — a user
// who needs link underlines on one device needs them everywhere.
// Zustand `persist` (`localStorage["underline-links"]`) is the local
// cache that bridges between cold-boot and the GET response.

interface LinkUnderlineState {
  underline: boolean;
  setUnderline: (next: boolean) => void;
  toggle: () => void;
}

export const useLinkUnderlineStore = create<LinkUnderlineState>()(
  persist(
    (set, get) => ({
      underline: false,
      setUnderline: (next) => set({ underline: next }),
      toggle: () => set({ underline: !get().underline }),
    }),
    { name: 'underline-links' }
  )
);

export function applyLinkUnderline(underline: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('underline-links', underline);
}
