import { Focus } from 'lucide-react';

import { useFocusRingStore } from '../state/focusRing.store';

// Single-line row toggle for the accessibility "Always show focus
// ring" setting. When ON, every focused element renders an outline
// via the CSS rule in src/index.css (`html.focus-always *:focus`),
// overriding the default :focus-visible behavior that hides the
// indicator on mouse-click activation.
export function FocusRingToggle() {
  const alwaysVisible = useFocusRingStore((s) => s.alwaysVisible);
  const toggle = useFocusRingStore((s) => s.toggle);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        <Focus aria-hidden="true" size={14} />
        Always show focus
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={alwaysVisible}
        aria-label="Always show focus"
        onClick={toggle}
        className={`focus-visible:ring-accent-500 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900 ${
          alwaysVisible
            ? 'bg-accent-600 dark:bg-accent-500'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            alwaysVisible ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
