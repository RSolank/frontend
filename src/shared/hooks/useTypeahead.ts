import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';

import { useTypeaheadKeyboard } from './useTypeaheadKeyboard';

// One option in a typeahead dropdown. `value` is the stable identity (and
// React key); `label` is what the user sees and the default haystack;
// `keywords` adds extra searchable text that isn't shown (e.g. a tag's full
// ancestor path) so filtering matches more than the visible label.
export interface TypeaheadOption {
  value: string;
  label: string;
  keywords?: string;
}

// Default substring filter — case-insensitive over label + keywords. A
// consumer with bespoke matching (fuzzy, token-prefix, …) passes its own.
export function defaultTypeaheadFilter(
  option: TypeaheadOption,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    option.label.toLowerCase().includes(q) ||
    (option.keywords?.toLowerCase().includes(q) ?? false)
  );
}

interface UseTypeaheadParams {
  // The full option list to surface. The consumer is responsible for any
  // domain-level exclusion (already-selected chips, a misc-tag rule, …) —
  // the engine only narrows by the typed query.
  options: TypeaheadOption[];
  // Commit a pick. The engine then clears the query and (by default) closes.
  onPick: (option: TypeaheadOption) => void;
  // Override the query→option match. Defaults to substring on label/keywords.
  filter?: (option: TypeaheadOption, query: string) => boolean;
  // Collapse the dropdown after a pick. Multi-select keeps it semantically a
  // "pick another" surface but still closes-on-pick by default for parity
  // with the single-select; typing re-opens it.
  closeOnPick?: boolean;
  // Stable id base for ARIA wiring (listbox + active option). Defaults to a
  // generated useId so two instances never collide.
  id?: string;
}

interface InputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  role: 'combobox';
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-autocomplete': 'list';
  'aria-activedescendant': string | undefined;
  autoComplete: 'off';
}

export interface TypeaheadOptionProps {
  id: string;
  role: 'option';
  'aria-selected': boolean;
  onMouseEnter: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

interface UseTypeaheadReturn {
  instanceId: string;
  listId: string;
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  filtered: TypeaheadOption[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  // Spread onto the search input.
  getInputProps: () => InputProps;
  // Spread onto each rendered option element (1:1 with `filtered`).
  getOptionProps: (
    option: TypeaheadOption,
    index: number
  ) => TypeaheadOptionProps;
  // Ref for the root container — used for close-on-click-outside.
  containerRef: RefObject<HTMLDivElement>;
  // Ref for the options list element — used to scroll the active option in.
  listRef: RefObject<HTMLDivElement>;
  // Programmatic pick (e.g. wired by the shell from a mouse handler).
  pick: (option: TypeaheadOption) => void;
}

// Headless combobox/typeahead engine shared by `SearchableSelect` and
// `SearchableMultiSelect`. Owns the query, open state, the query-filtered
// option list, keyboard navigation (via `useTypeaheadKeyboard`), close-on-
// click-outside, and the pick→clear-query→close orchestration. The shells
// supply only markup + chip/selection state, so "search input + dropdown"
// behaviour is single-sourced (CONTRIBUTING.md §6).
//
// Keyboard nav re-pins the active row on query / list-length change — NOT on
// the options array reference — so a parent that rebuilds `options` each
// render can't freeze arrow-nav (the original SearchableSelect bug).
export function useTypeahead({
  options,
  onPick,
  filter = defaultTypeaheadFilter,
  closeOnPick = true,
  id,
}: UseTypeaheadParams): UseTypeaheadReturn {
  const generatedId = useId();
  const instanceId = id ?? generatedId;
  const listId = `${instanceId}-listbox`;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => options.filter((o) => filter(o, query)),
    [options, query, filter]
  );

  const pick = useCallback(
    (option: TypeaheadOption) => {
      onPick(option);
      setQuery('');
      if (closeOnPick) setOpen(false);
    },
    [onPick, closeOnPick]
  );

  const { activeIndex, setActiveIndex, handleKeyDown } = useTypeaheadKeyboard({
    itemCount: filtered.length,
    open,
    setOpen,
    onSelect: (i) => {
      const o = filtered[i];
      if (o) pick(o);
    },
    resetSignal: query,
    listRef,
  });

  // Close on click-outside (mousedown so it fires before option onMouseDown).
  useEffect(() => {
    if (!open) return undefined;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const activeId =
    open && filtered[activeIndex]
      ? `${instanceId}-opt-${filtered[activeIndex]!.value}`
      : undefined;

  const getInputProps = useCallback(
    (): InputProps => ({
      value: query,
      onChange: (e) => {
        setQuery(e.target.value);
        setOpen(true);
      },
      onFocus: () => setOpen(true),
      onKeyDown: handleKeyDown,
      role: 'combobox',
      'aria-expanded': open,
      'aria-controls': listId,
      'aria-autocomplete': 'list',
      'aria-activedescendant': activeId,
      autoComplete: 'off',
    }),
    [query, open, handleKeyDown, listId, activeId]
  );

  const getOptionProps = useCallback(
    (option: TypeaheadOption, index: number): TypeaheadOptionProps => ({
      id: `${instanceId}-opt-${option.value}`,
      role: 'option',
      'aria-selected': index === activeIndex,
      onMouseEnter: () => setActiveIndex(index),
      onMouseDown: (e) => {
        // Keep focus in the input on pick — onMouseDown fires before blur, so
        // the cursor stays put and typing re-opens the filtered list.
        e.preventDefault();
        pick(option);
      },
    }),
    [instanceId, activeIndex, setActiveIndex, pick]
  );

  return {
    instanceId,
    listId,
    query,
    setQuery,
    open,
    setOpen,
    filtered,
    activeIndex,
    setActiveIndex,
    getInputProps,
    getOptionProps,
    containerRef,
    listRef,
    pick,
  };
}
