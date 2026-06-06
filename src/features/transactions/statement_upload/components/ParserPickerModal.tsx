import { useEffect, useState } from 'react';

import { Modal } from '../../../../shared/components/Modal';
import type { ParserOption } from '../api/schemas';

import { ParserIcon } from './ParserIcon';

interface Props {
  open: boolean;
  parsers: readonly ParserOption[];
  // The parser whose row is highlighted when the modal opens.
  // `null` shows nothing selected (Save disabled until pick).
  initialKey: string | null;
  onClose: () => void;
  onConfirm: (key: string) => void;
}

// Parser picker — opens from the matched-card "Change parser"
// link or from the 422 "Pick parser" affordance on the inline
// error. Lists every parser in the catalogue; the row's `label`
// is the user-facing string, `source_type` is the secondary
// helper. Save is disabled until a parser is highlighted.
//
// The picker confirms a *class* (the registry `key`); the BE
// resolves the actual parser variant inside that class.
export function ParserPickerModal({
  open,
  parsers,
  initialKey,
  onClose,
  onConfirm,
}: Props) {
  const [pick, setPick] = useState<string | null>(initialKey);

  useEffect(() => {
    if (open) setPick(initialKey);
  }, [open, initialKey]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pick a statement parser"
      description="Choose the bank or service this statement came from. The processor will use your pick and fall back to its own detection only if parsing fails."
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => pick && onConfirm(pick)}
            disabled={pick === null}
            className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="parser-picker-confirm"
          >
            Use this parser
          </button>
        </div>
      }
    >
      <ul
        className="flex flex-col gap-2"
        role="radiogroup"
        data-testid="parser-picker-list"
      >
        {parsers.map((parser) => (
          <li key={parser.key}>
            <label
              className={[
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                pick === parser.key
                  ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              <input
                type="radio"
                name="parser-pick"
                value={parser.key}
                checked={pick === parser.key}
                onChange={() => setPick(parser.key)}
                aria-label={parser.label}
                className="mt-1"
                data-testid={`parser-picker-option-${parser.key}`}
              />
              <ParserIcon parserKey={parser.key} size={22} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {parser.label}
                </span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {parser.key}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
