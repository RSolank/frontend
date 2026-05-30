import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // 'danger' paints the confirm button red; 'primary' paints it indigo.
  intent?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

// Confirmation modal — single sentence + Confirm / Cancel pair. Replaces
// window.confirm() across the app (Batch 6.5). Sizing fixed at 'sm'.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  intent = 'primary',
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmClass =
    intent === 'danger'
      ? 'inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60'
      : 'btn-primary !w-auto';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className={confirmClass}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700 dark:text-slate-200">{message}</p>
    </Modal>
  );
}
