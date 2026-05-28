import { ChevronDown, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (next: string) => void;
  // Accessible name — required so the input never relies on visual
  // label-association alone. Pass the same string a `<label>` would
  // carry.
  ariaLabel: string;
  // Placeholder when nothing is selected (e.g. "All tags").
  placeholder?: string;
  // Optional id for label association.
  id?: string;
  // When false, the input is a plain readonly affordance — no typing.
  // Defaults to true (the whole point of this component is typeahead).
  searchable?: boolean;
}

// Generic single-select dropdown with built-in typeahead filtering.
// Use this any time a `<select>` would otherwise have more than 15
// options, be data-driven, or have no inherent scan order — see
// CONTRIBUTING.md §6 "Searchable dropdowns".
//
// Pick-or-create flows (beneficiaries, tag picker on Add Transaction)
// continue to use the dedicated `SearchableList`-style components
// from the §6 "Searchable list with inline create" convention; this
// component is the pick-only complement (no `+ Add new` CTA).
//
// Keyboard nav: ↑/↓ moves highlight, Enter selects, Esc closes,
// hover updates the highlight so click + keyboard don't conflict.
// ARIA role=combobox + listbox + option + aria-activedescendant for
// screen readers.
export function SearchableSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = '',
  id,
  searchable = true,
}: SearchableSelectProps) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  // Keep the visible draft in sync with the externally-controlled
  // value. When the parent changes `value` (e.g. via URL state on
  // navigation), the input reflects the new selection without the
  // user retyping.
  useEffect(() => {
    setDraft(selected?.label ?? '');
  }, [selected]);

  // Close on click-outside.
  useEffect(() => {
    if (!focused) return undefined;
    function handleClick(e: MouseEvent) {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        setFocused(false);
        // Restore the selected label if user closed without picking.
        setDraft(selected?.label ?? '');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [focused, selected]);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    // When the input's text matches the selected option exactly (the
    // common "user just opened the dropdown" state), show the full
    // list rather than filtering down to one row — gives the user
    // the full set to switch between.
    if (!q || (selected && q === selected.label.toLowerCase())) {
      return options;
    }
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [draft, options, selected]);

  // Reset / pin highlight when the filtered list changes or the
  // dropdown opens — preselect the currently-selected option's
  // index when present so arrow-down moves to the next option.
  useEffect(() => {
    if (!focused) return;
    const selectedIdx = filtered.findIndex((o) => o.value === value);
    setHighlightIdx(selectedIdx >= 0 ? selectedIdx : 0);
  }, [focused, filtered, value]);

  // Scroll the highlighted item into view.
  useEffect(() => {
    if (!focused || filtered.length === 0) return;
    const list = listRef.current;
    if (!list) return;
    const child = list.children[highlightIdx] as HTMLElement | undefined;
    if (child) child.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, focused, filtered.length]);

  function pick(option: SearchableSelectOption) {
    onChange(option.value);
    setDraft(option.label);
    setFocused(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange('');
    setDraft('');
    setFocused(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused(true);
      if (filtered.length === 0) return;
      setHighlightIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused(true);
      if (filtered.length === 0) return;
      setHighlightIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      if (!focused || filtered.length === 0) return;
      e.preventDefault();
      const o = filtered[highlightIdx];
      if (o) pick(o);
    } else if (e.key === 'Escape') {
      if (!focused) return;
      e.preventDefault();
      setFocused(false);
      setDraft(selected?.label ?? '');
    }
  }

  const activeId =
    focused && filtered[highlightIdx]
      ? `${id ?? 'sselect'}-opt-${filtered[highlightIdx]!.value || 'empty'}`
      : undefined;

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          onChange={(e) => {
            if (!searchable) return;
            setDraft(e.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onClick={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={!searchable}
          aria-label={ariaLabel}
          autoComplete="off"
          role="combobox"
          aria-expanded={focused}
          aria-controls={`${id ?? 'sselect'}-listbox`}
          aria-autocomplete={searchable ? 'list' : 'none'}
          aria-activedescendant={activeId}
          className="form-input !pr-14"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${ariaLabel}`}
            tabIndex={-1}
            className="absolute top-1/2 right-7 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X aria-hidden size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setFocused((f) => !f);
            inputRef.current?.focus();
          }}
          aria-label={focused ? 'Close options' : 'Open options'}
          tabIndex={-1}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ChevronDown
            aria-hidden
            size={16}
            className={`transition-transform ${focused ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {focused && filtered.length > 0 && (
        <div
          ref={listRef}
          id={`${id ?? 'sselect'}-listbox`}
          role="listbox"
          className="absolute right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          {filtered.map((o, idx) => {
            const isHighlighted = idx === highlightIdx;
            const isSelected = o.value === value;
            return (
              <button
                key={o.value || '__empty__'}
                id={`${id ?? 'sselect'}-opt-${o.value || 'empty'}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  // Prevent the input from blurring before click
                  // registers — onMouseDown fires before onBlur.
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  isHighlighted
                    ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100'
                    : isSelected
                      ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {focused && filtered.length === 0 && (
        <div className="absolute right-0 left-0 z-20 mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
          No matches
        </div>
      )}
    </div>
  );
}
