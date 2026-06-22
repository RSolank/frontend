import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { Modal } from '../../../shared/components/Modal';
import type { TransactionDTO } from '../api/schemas';

export type OnPaymentChoice = 'reopen' | 'preserve';

/**
 * True when the pending-delete txn settles a consumption-tax bill (it carries
 * the reserved Consumption Tax tag). Presence of the tag is the trigger; the
 * backend handles whichever bills it actually backed.
 */
export function pendingTxnIsTaxPayment(
  transactions: TransactionDTO[],
  confirmDeleteId: number | null,
  consumptionTaxTagId: number | undefined
): boolean {
  if (confirmDeleteId == null || consumptionTaxTagId == null) return false;
  const txn = transactions.find((t) => t.txn_id === confirmDeleteId);
  return txn?.tag_ids?.includes(consumptionTaxTagId) ?? false;
}

interface DeleteTransactionDialogProps {
  open: boolean;
  // When the txn settles a tax bill, offer the two-path prompt instead of the
  // plain confirm.
  isTaxPayment: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (onPayment?: OnPaymentChoice) => void;
}

export function DeleteTransactionDialog({
  open,
  isTaxPayment,
  busy,
  error,
  onCancel,
  onConfirm,
}: DeleteTransactionDialogProps) {
  if (!isTaxPayment) {
    return (
      <ConfirmDialog
        open={open}
        onClose={onCancel}
        onConfirm={() => onConfirm()}
        intent="danger"
        title="Delete transaction"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        confirmLabel="Delete"
        busy={busy}
      />
    );
  }
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Delete a tax payment?"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm('preserve')}
            disabled={busy}
            className="btn-primary !w-auto"
          >
            {busy ? 'Working…' : 'Keep bill paid'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm('reopen')}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md bg-danger-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-700 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reopen &amp; delete
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700 dark:text-slate-200">
        This transaction settles a consumption-tax bill. Keep that bill marked
        as paid, or reopen it as unpaid? Either way the transaction is deleted.
      </p>
      {error ? <p className="text-danger-600 mt-2 text-sm">{error}</p> : null}
    </Modal>
  );
}
