import { Monitor, Moon, Sun } from 'lucide-react';

import { type ThemeMode, useThemeStore } from '../state/theme.store';

interface ThemeOptionsProps {
  // When the parent wants to dismiss itself on selection (e.g. the
  // mobile drawer closes after the user picks a mode). Optional.
  onSelect?: () => void;
}

interface ThemeOptionSpec {
  mode: ThemeMode;
  label: string;
  icon: typeof Sun;
}

const OPTIONS: ThemeOptionSpec[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

// Theme control surface — single labeled row with three icon buttons
// (Light / Dark / System) shown as a segmented control. Used in
// contexts where the compact <ThemeToggle /> cycler reads as out of
// place — typically the mobile drawer next to other section-labeled
// items. Icons are universally recognized for these three modes; an
// explicit aria-label keeps screen-reader accessibility intact.
export function ThemeOptions({ onSelect }: ThemeOptionsProps = {}) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center justify-between gap-3 px-4 py-2"
    >
      <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        Theme
      </span>
      <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 p-1 dark:bg-slate-800">
        {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
          const active = mode === optionMode;
          return (
            <button
              key={optionMode}
              type="button"
              onClick={() => {
                setMode(optionMode);
                onSelect?.();
              }}
              aria-label={`${label} theme`}
              aria-pressed={active}
              title={label}
              className={`focus-visible:ring-accent-500 flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-800 ${
                active
                  ? 'text-accent-700 dark:text-accent-300 bg-white shadow-sm dark:bg-slate-700'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
              }`}
            >
              <Icon aria-hidden="true" size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
