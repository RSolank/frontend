import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility — when ON, the app overrides its low-contrast neutral
// palette (slate-500/400 secondary text, accent-50/950 hover surfaces)
// with WCAG-AAA-tier pairings. Mostly affects dark mode, where the
// default contrast is closest to the AA floor. Toggled via a CSS
// class on <html>; component code doesn't change.
//
// Frontend-only (Zustand `persist` ⇒ `localStorage["contrast"]`) by
// design. Does NOT follow the user across devices.

interface ContrastState {
  high: boolean;
  setHigh: (next: boolean) => void;
  toggle: () => void;
}

export const useContrastStore = create<ContrastState>()(
  persist(
    (set, get) => ({
      high: false,
      setHigh: (next) => set({ high: next }),
      toggle: () => set({ high: !get().high }),
    }),
    { name: 'contrast' }
  )
);

export function applyContrast(high: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('high-contrast', high);
}
