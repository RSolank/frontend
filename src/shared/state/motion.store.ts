import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Accessibility — user-controlled reduced-motion override. Sits ON TOP
// of the OS-level `prefers-reduced-motion` (which Tailwind's
// `motion-reduce:` modifier already honors). When this store's
// `reducedMotion` flag is true, the entire app pauses transitions /
// animations via a CSS class on <html>, regardless of OS preference.
//
// Persisted locally via Zustand `persist` ⇒ `localStorage["motion"]`.
// Backend sync is queued (see implementation_plan.md → Backend
// follow-ups).

interface MotionState {
  reducedMotion: boolean;
  setReducedMotion: (next: boolean) => void;
  toggle: () => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set, get) => ({
      reducedMotion: false,
      setReducedMotion: (next) => set({ reducedMotion: next }),
      toggle: () => set({ reducedMotion: !get().reducedMotion }),
    }),
    { name: 'motion' }
  )
);

// Idempotent: paint / clear the .reduce-motion class on <html>. The
// CSS rule in src/index.css targets that class to disable transitions
// and animations app-wide.
export function applyMotion(reduced: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('reduce-motion', reduced);
}
