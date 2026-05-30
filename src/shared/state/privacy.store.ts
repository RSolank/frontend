import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility / privacy — when ON, every element marked with the
// `money` class blurs (CSS rule in src/index.css) so amounts aren't
// visible during screen-shares, screenshots, or shoulder-surfing.
// Hovering an individual element reveals it. The store flips a class
// on <html>; no React re-render is required because the CSS rule
// targets the existing DOM.
//
// Persisted locally via Zustand `persist` ⇒ `localStorage["privacy"]`.

interface PrivacyState {
  mask: boolean;
  setMask: (next: boolean) => void;
  toggle: () => void;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set, get) => ({
      mask: false,
      setMask: (next) => set({ mask: next }),
      toggle: () => set({ mask: !get().mask }),
    }),
    { name: 'privacy' }
  )
);

export function applyPrivacyMask(mask: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('mask-amounts', mask);
}
