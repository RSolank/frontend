import type { ReactNode, RefObject } from 'react';

import type {
  TypeaheadOption,
  TypeaheadOptionProps,
} from '../hooks/useTypeahead';

// The sticky "+ {label}" inline-create CTA (Type A) shared by every picker
// that fronts a user-CRUD option list. onMouseDown (not onClick) so it fires
// before the input blur / click-outside collapses the dropdown.
export function CreateOptionCTA({
  label,
  onSelect,
}: {
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className="bg-accent-50/40 text-accent-700 hover:bg-accent-100 dark:bg-accent-950/30 dark:text-accent-300 dark:hover:bg-accent-950/50 flex w-full items-center gap-1.5 border-b border-slate-200 px-3 py-2 text-left text-sm font-semibold dark:border-slate-700"
    >
      <span aria-hidden="true">＋</span>
      {label}
    </button>
  );
}

// Option-row styling by highlight / selection state — if/else (not a nested
// ternary) so it reads cleanly and stays off sonarjs/no-nested-conditional.
function optionClassName(isActive: boolean, isSelected: boolean): string {
  const base = 'block w-full px-3 py-2 text-left text-sm ';
  if (isActive)
    return `${base}bg-accent-100 text-accent-900 dark:bg-accent-950/60 dark:text-accent-100`;
  if (isSelected)
    return `${base}bg-accent-50 text-accent-800 dark:bg-accent-950/30 dark:text-accent-200`;
  return `${base}text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800`;
}

interface TypeaheadPanelProps {
  open: boolean;
  listId: string;
  listRef: RefObject<HTMLDivElement>;
  filtered: TypeaheadOption[];
  activeIndex: number;
  // Spread onto each option element (id / role / aria / mouse handlers).
  getOptionProps: (
    option: TypeaheadOption,
    index: number
  ) => TypeaheadOptionProps;
  // Mark an option as the current single-select value (selected styling).
  selectedValue?: string;
  // Override the option's rendered content (default: `option.label`).
  renderOption?: (option: TypeaheadOption) => ReactNode;
  // Inline "create a new option" CTA (Type A). When set, a sticky first row
  // renders `createLabel` and fires `onCreate` (the consumer opens its own
  // create modal). Only for user-CRUD-managed option lists.
  onCreate?: () => void;
  createLabel?: string;
  emptyLabel?: string;
}

// The dropdown surface shared by every "search input + dropdown" picker:
// the optional create CTA, the query-filtered option list (role=listbox),
// and the empty state. Positioned absolutely under the input; the consumer
// owns the relative-positioned wrapper. Behaviour comes from `useTypeahead`
// (open state, keyboard, getOptionProps); this is the presentational half.
export function TypeaheadPanel({
  open,
  listId,
  listRef,
  filtered,
  activeIndex,
  getOptionProps,
  selectedValue,
  renderOption,
  onCreate,
  createLabel = 'Add new',
  emptyLabel = 'No matches',
}: TypeaheadPanelProps) {
  if (!open) return null;

  return (
    <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
      {onCreate && <CreateOptionCTA label={createLabel} onSelect={onCreate} />}
      {filtered.length === 0 ? (
        <div className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div role="listbox" id={listId} ref={listRef}>
          {filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              {...getOptionProps(option, index)}
              className={optionClassName(
                index === activeIndex,
                option.value === selectedValue
              )}
            >
              {renderOption ? renderOption(option) : option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
