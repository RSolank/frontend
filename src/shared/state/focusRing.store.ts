import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility — focus indicators today are gated behind
// `:focus-visible`, which the browser hides on mouse-click activation.
// Keyboard-first users (and screen-reader users navigating with
// arrows) benefit from the indicator on every interaction. When ON,
// the app forces a visible outline on `:focus` regardless of input
// modality.
//
// Frontend-only (Zustand `persist` ⇒ `localStorage["focus-ring"]`).
// Does NOT follow the user across devices.

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
