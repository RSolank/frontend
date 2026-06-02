import { X } from 'lucide-react';

import type {
  AccountIdentifier,
  AccountIdentifierCreatePayload,
} from '../api/schemas';

interface Props {
  // Either persisted identifiers (edit mode) or pending ones
  // (create mode). The discriminator on `uid` keeps the render
  // single-path while letting the parent fire the right action
  // (DELETE endpoint vs. local-state splice).
  identifiers: ReadonlyArray<AccountIdentifier | AccountIdentifierCreatePayload>;
  onRemove: (
    identifier: AccountIdentifier | AccountIdentifierCreatePayload,
    index: number
  ) => void;
  // When set, the user is mid-write and chip removal should be
  // visually disabled (we don't want a click to race with the
  // in-flight POST).
  busy?: boolean;
}

// Identifier chip rail — one chip per identifier with a small ×
// remove button. Persisted identifiers fire a DELETE on remove;
// pending ones splice out of local state.
export function IdentifierChips({ identifiers, onRemove, busy = false }: Props) {
  if (identifiers.length === 0) {
    return (
      <p
        className="text-xs italic text-slate-500 dark:text-slate-400"
        data-testid="bank-account-identifier-empty"
      >
        No identifiers yet. UPI handles let statement uploads
        auto-attribute payments to this account.
      </p>
    );
  }
  return (
    <ul
      className="flex flex-wrap gap-2"
      data-testid="bank-account-identifier-chips"
    >
      {identifiers.map((identifier, index) => (
        <li
          key={'uid' in identifier ? `live-${identifier.uid}` : `pending-${index}`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800">
            <span className="rounded-sm bg-accent-100 px-1 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-700 dark:bg-accent-950/60 dark:text-accent-300">
              {identifier.identifier_type}
            </span>
            <span className="font-mono text-slate-800 dark:text-slate-200">
              {identifier.identifier}
            </span>
            <button
              type="button"
              onClick={() => onRemove(identifier, index)}
              disabled={busy}
              aria-label={`Remove ${identifier.identifier}`}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-danger-100 hover:text-danger-700 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-danger-950/50 dark:hover:text-danger-300"
            >
              <X size={10} />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
