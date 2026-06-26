import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { Modal } from '../../../shared/components/Modal';
import { mergeBeneficiariesRequest } from '../api/mutations';
import type { Beneficiary } from '../api/queries';

import { MergeBeneficiariesForm } from './MergeBeneficiariesForm';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface MergeBeneficiariesDialogProps {
  open: boolean;
  onClose: () => void;
  // Refetch trigger after a successful merge.
  onMerged: () => void | Promise<void>;
  beneficiaries: Beneficiary[];
  // Pre-fill (typically from an edit dialog: the source is the row
  // being merged AWAY). Either side can be empty until the user picks.
  initialSourceUid?: number | null;
  initialTargetUid?: number | null;
}

// Modal wrapper around <MergeBeneficiariesForm /> with confirmation +
// API call + busy state. Used by:
//   - BeneficiariesPage list header (free-form merge — both sides
//     empty initially)
//   - BeneficiaryFormDialog edit mode (pre-fills source with the row
//     being edited)
export function MergeBeneficiariesDialog({
  open,
  onClose,
  onMerged,
  beneficiaries,
  initialSourceUid = null,
  initialTargetUid = null,
}: MergeBeneficiariesDialogProps) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Destructive-op confirm (Batch 15 — replaces window.confirm).
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSource(initialSourceUid != null ? String(initialSourceUid) : '');
      setTarget(initialTargetUid != null ? String(initialTargetUid) : '');
      setError(null);
      setBusy(false);
    }
  }, [open, initialSourceUid, initialTargetUid]);

  function handleSwap() {
    setSource(target);
    setTarget(source);
  }

  function handleMerge() {
    setError(null);
    if (!source || !target) {
      setError('Pick a source and a target.');
      return;
    }
    if (source === target) {
      setError('Source and target must differ.');
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmMerge() {
    setConfirmOpen(false);
    setBusy(true);
    try {
      await mergeBeneficiariesRequest({
        source_uid: parseInt(source, 10),
        target_uid: parseInt(target, 10),
      });
      await onMerged();
      onClose();
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Merge failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Consolidate beneficiaries"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="tap-press rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </>
      }
    >
      <MergeBeneficiariesForm
        beneficiaries={beneficiaries}
        mergeSource={source}
        mergeTarget={target}
        onSourceChange={setSource}
        onTargetChange={setTarget}
        onSwap={handleSwap}
        onMerge={handleMerge}
      />
      {error && <div className="form-error mt-3">{error}</div>}
      {busy && (
        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Merging…
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Merge beneficiaries?"
        message="Merging will consolidate all aliases and update all transaction links. This cannot be undone."
        confirmLabel="Merge"
        cancelLabel="Cancel"
        intent="danger"
        busy={busy}
        onConfirm={() => void confirmMerge()}
        onClose={() => setConfirmOpen(false)}
      />
    </Modal>
  );
}
