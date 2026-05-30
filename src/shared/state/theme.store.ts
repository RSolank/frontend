import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
}

const cycleOrder: ThemeMode[] = ['system', 'light', 'dark'];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
      cycle: () => {
        const i = cycleOrder.indexOf(get().mode);
        const next = cycleOrder[(i + 1) % cycleOrder.length] ?? 'system';
        set({ mode: next });
      },
    }),
    { name: 'theme' }
  )
);

// Resolve user choice + OS preference to the actual class we apply.
export function resolveEffectiveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return mode;
}

// Toggle the .dark class on <html> to match the effective mode. Idempotent.
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const effective = resolveEffectiveMode(mode);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}
