import { Underline } from 'lucide-react';

import { useLinkUnderlineStore } from '../state/linkUnderline.store';

// Single-line row toggle for the accessibility "Underline links"
// setting. When ON, every <a> element gets `text-decoration:
// underline` via the CSS rule in src/index.css.
export function LinkUnderlineToggle() {
  const underline = useLinkUnderlineStore((s) => s.underline);
  const toggle = useLinkUnderlineStore((s) => s.toggle);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        <Underline aria-hidden="true" size={14} />
        Underline links
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={underline}
        aria-label="Underline links"
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900 ${
          underline
            ? 'bg-indigo-600 dark:bg-indigo-500'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            underline ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
