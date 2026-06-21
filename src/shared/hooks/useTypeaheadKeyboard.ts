import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';

interface UseTypeaheadKeyboardOptions {
  // Number of navigable options currently shown in the dropdown.
  itemCount: number;
  // Whether the dropdown is open.
  open: boolean;
  // Open / close the dropdown (ArrowDown opens; Escape closes).
  setOpen: (open: boolean) => void;
  // Pick the option at `index` (Enter on the active option).
  onSelect: (index: number) => void;
  // A value that, when it changes, re-pins the active option to
  // `initialIndex` — pass the search query so typing resets the highlight to
  // the top of the freshly-filtered list.
  resetSignal?: unknown;
  // Where the active option pins on open / reset. Default 0 (first option);
  // a single-select picker can pass the selected option's index.
  initialIndex?: number;
  // The options container whose direct children are the option elements
  // (1:1 with the active index) — used to scroll the active option into view
  // in a long list. Omit for short lists that never scroll.
  listRef?: RefObject<HTMLElement | null>;
}

interface UseTypeaheadKeyboardReturn {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
}

// Shared keyboard navigation for "search input + dropdown list" pickers
// (combobox/typeahead). One implementation behind the bespoke pickers
// (TagPicker, BeneficiaryPicker, the transaction tag/beneficiary search,
// AdminUserPicker) so they all get the same ↓/↑/Enter/Esc behaviour the
// shared SearchableSelect already has.
//
// ARIA: the consumer wires `handleKeyDown` to its input's `onKeyDown`,
// renders each option highlighted when its index === `activeIndex` (and
// `onMouseEnter={() => setActiveIndex(i)}` so hover + keyboard agree), and
// reflects the active option in `aria-activedescendant`.
//
// The active-index pin is keyed on **primitives** (`open`, `resetSignal`,
// `itemCount`) — NOT the options array reference — so a parent re-render that
// rebuilds the options prop on every render doesn't clobber an in-progress
// ArrowDown (the bug that froze keyboard nav in SearchableSelect).
export function useTypeaheadKeyboard({
  itemCount,
  open,
  setOpen,
  onSelect,
  resetSignal,
  initialIndex = 0,
  listRef,
}: UseTypeaheadKeyboardOptions): UseTypeaheadKeyboardReturn {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // Re-pin on open / query change / list-length change.
  useEffect(() => {
    if (open) setActiveIndex(initialIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetSignal, itemCount, initialIndex]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const child = listRef?.current?.children[activeIndex] as
      | HTMLElement
      | undefined;
    child?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, itemCount, listRef]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        if (itemCount > 0) setActiveIndex((i) => (i + 1) % itemCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
        if (itemCount > 0) setActiveIndex((i) => (i - 1 + itemCount) % itemCount);
      } else if (e.key === 'Enter') {
        if (!open || itemCount === 0) return;
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < itemCount) onSelect(activeIndex);
      } else if (e.key === 'Escape') {
        if (!open) return;
        e.preventDefault();
        setOpen(false);
      }
    },
    [itemCount, open, activeIndex, onSelect, setOpen]
  );

  return { activeIndex, setActiveIndex, handleKeyDown };
}
