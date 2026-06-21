import type { ReactNode } from 'react';

import { useTypeahead, type TypeaheadOption } from '../hooks/useTypeahead';

import { TypeaheadPanel } from './TypeaheadPanel';

// What a consumer's `renderToken` receives for a selected chip.
export interface TokenRenderArgs {
  value: string;
  label: string;
  index: number;
  remove: () => void;
}

interface SearchableMultiSelectProps {
  // Available options (the consumer excludes already-selected values and any
  // domain-specific exclusions before passing them in).
  options: TypeaheadOption[];
  // Selected values, in display order (chip order). The first is treated as
  // "primary" by consumers that care (e.g. categorization tags).
  selectedValues: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  // Resolve a value → its display label (default chip + remove aria-label).
  tokenLabel: (value: string) => string;
  // Accessible name for the search input.
  ariaLabel: string;
  // Visible form label (rendered above the input). Omit for label-less use.
  label?: string;
  id?: string;
  placeholder?: string;
  // Bespoke query→option match (defaults to substring on label/keywords).
  filter?: (option: TypeaheadOption, query: string) => boolean;
  // Override an option's rendered row content (default: `option.label`).
  renderOption?: (option: TypeaheadOption) => ReactNode;
  // Type A inline create: renders the "+ {createLabel}" CTA and fires
  // `onCreate(query)` with the current search text (the consumer opens its own
  // create modal pre-filled with it, then adds the resulting value). Omit for
  // fixed/system option lists.
  onCreate?: (query: string) => void;
  createLabel?: string;
  // Override chip rendering (e.g. primary badge + promote button). The
  // default is a plain removable accent pill.
  renderToken?: (args: TokenRenderArgs) => ReactNode;
  emptyTokensLabel?: string;
}

// Default chip: a plain removable accent pill. Consumers needing primary /
// promote affordances pass `renderToken`.
function DefaultToken({ label, remove }: TokenRenderArgs) {
  return (
    <span className="bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={remove}
        className="text-accent-500 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-200"
      >
        ×
      </button>
    </span>
  );
}

// Multi-select chip-accumulating typeahead — the shared shell behind the
// categorization-rule tag picker and the transaction tag selector. Each pick
// (or inline create) adds a chip and resets the query; the same `useTypeahead`
// engine drives the dropdown + keyboard nav as `SearchableSelect`. Per-consumer
// chip differences (primary/promote vs plain) come through `renderToken`;
// inline option creation (Type A) through `onCreate`. See CONTRIBUTING.md §6.
export function SearchableMultiSelect({
  options,
  selectedValues,
  onAdd,
  onRemove,
  tokenLabel,
  ariaLabel,
  label,
  id,
  placeholder = 'Search…',
  filter,
  renderOption,
  onCreate,
  createLabel,
  renderToken,
  emptyTokensLabel = 'Nothing selected',
}: SearchableMultiSelectProps) {
  const t = useTypeahead({
    options,
    onPick: (option) => onAdd(option.value),
    filter,
    id,
  });

  const inputId = id ? `${id}-input` : undefined;
  const renderChip = renderToken ?? DefaultToken;

  return (
    <div ref={t.containerRef} className="relative">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <input
        {...t.getInputProps()}
        id={inputId}
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="form-input"
      />
      <TypeaheadPanel
        open={t.open}
        listId={t.listId}
        listRef={t.listRef}
        filtered={t.filtered}
        activeIndex={t.activeIndex}
        getOptionProps={t.getOptionProps}
        renderOption={renderOption}
        onCreate={
          onCreate
            ? () => {
                onCreate(t.query);
                t.setOpen(false);
              }
            : undefined
        }
        createLabel={createLabel}
      />
      <div className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {selectedValues.length === 0 ? (
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {emptyTokensLabel}
          </span>
        ) : (
          selectedValues.map((value, index) => (
            <span key={value}>
              {renderChip({
                value,
                label: tokenLabel(value),
                index,
                remove: () => onRemove(value),
              })}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
