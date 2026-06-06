import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';

// Lock-confirm dialog with an optional reason textarea (T-admin B1).
// Built on `Modal` directly (instead of `ConfirmDialog`) because the
// shared confirm dialog only accepts a single string message —
// extending it to support form fields would touch every consumer.
// Reason is free-text, 0-280 chars, stored on the audit row by the
// BE (B1 logs it on the lock event).

const MAX_REASON_CHARS = 280;

interface LockUserDialogProps {
  open: boolean;
  userLabel: string;
  busy?: boolean;
  errorMessage?: string | null;
  onConfirm: (reason: string | undefined) => void | Promise<void>;
  onClose: () => void;
}

export function LockUserDialog({
  open,
  userLabel,
  busy = false,
  errorMessage,
  onConfirm,
  onClose,
}: LockUserDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const remaining = MAX_REASON_CHARS - reason.length;

  function handleClose() {
    if (busy) return;
    setReason('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Lock account"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm(trimmed || undefined)}
            className="bg-danger-600 hover:bg-danger-700 focus-visible:ring-danger-500 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Locking…' : 'Lock account'}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Lock <span className="font-medium">{userLabel}</span>? They will be
        unable to sign in, refresh sessions, or recover via password reset until
        an operator unlocks the account.
      </p>
      <div className="mt-3">
        <label
          htmlFor="admin-lock-reason"
          className="form-label text-xs tracking-wider uppercase"
        >
          Reason (optional, internal audit only)
        </label>
        <textarea
          id="admin-lock-reason"
          rows={3}
          value={reason}
          maxLength={MAX_REASON_CHARS}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
          className="form-input"
          placeholder="e.g. credentials reported compromised by user"
        />
        <p className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">
          {remaining} characters remaining
        </p>
      </div>
      {errorMessage ? (
        <p className="text-danger-700 dark:text-danger-300 mt-3 text-sm">
          {errorMessage}
        </p>
      ) : null}
    </Modal>
  );
}
