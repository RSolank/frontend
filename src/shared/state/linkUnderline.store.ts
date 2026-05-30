import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility — when ON, every `<a>` element gets `text-decoration:
// underline` so links are distinguishable from surrounding text by
// shape, not just color (WCAG 1.4.1). The app's links currently rely
// on indigo color alone to signal interactivity; users with color-
// vision differences can flip this on for an unmistakable link cue.
//
// Frontend-only (Zustand `persist` ⇒ `localStorage["underline-links"]`).
// Does NOT follow the user across devices.

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
