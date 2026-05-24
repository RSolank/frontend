import { Monitor, Moon, Sun } from 'lucide-react';

import { type ThemeMode, useThemeStore } from '../state/theme.store';

const ICON_BY_MODE: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABEL_BY_MODE: Record<ThemeMode, string> = {
  light: 'Theme: light. Click to switch to dark.',
  dark: 'Theme: dark. Click to switch to system.',
  system: 'Theme: follow system. Click to switch to light.',
};

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const cycle = useThemeStore((s) => s.cycle);
  const Icon = ICON_BY_MODE[mode];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={LABEL_BY_MODE[mode]}
      title={LABEL_BY_MODE[mode]}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}
