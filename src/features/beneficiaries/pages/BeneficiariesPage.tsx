import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../../../shared/components/Button';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { SystemChip } from '../../../shared/components/SystemChip';
import { useModal, useUrlValueModal } from '../../../shared/hooks/useModal';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { highlightClass } from '../../../shared/utils/highlight';
import { formatAliasesDisplay } from '../api/aliases';
import { beneficiaryKeys } from '../api/keys';
import { deleteBeneficiaryRequest } from '../api/mutations';
import { type Beneficiary, useBeneficiariesQuery } from '../api/queries';
import { BeneficiaryFormDialog } from '../components/BeneficiaryFormDialog';
import { MergeBeneficiariesDialog } from '../components/MergeBeneficiariesDialog';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

type TypeFilter = 'all' | 'merchant' | 'person';

// List page hosts all CRUD flows as modals over the list (Batch 6.5
// retrofit + 2026-05-26 follow-up). URL state for shareable modals:
//   ?add=true        → BeneficiaryFormDialog (create)
//   ?edit=<uid>      → BeneficiaryFormDialog (edit; also the "Details"
//                      entry point — the dedicated detail route now
//                      redirects here)
//   ?merge=true      → MergeBeneficiariesDialog
export function BeneficiariesPage() {
  const queryClient = useQueryClient();
  const {
    data: beneficiaries = [],
    isLoading,
    error,
  } = useBeneficiariesQuery();

  const addModal = useModal({ urlKey: 'add' });
  const editModal = useUrlValueModal('edit');
  const mergeModal = useModal({ urlKey: 'merge' });
  const [confirmDelete, setConfirmDelete] = useState<Beneficiary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Row highlight on save (CONTRIBUTING.md §6 "Row highlight on save").
  const { id: highlightUid, flash } = useRowHighlight<number>();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Cross-modal hand-off: when the user clicks "Merge…" inside the
  // edit modal we close it and open the merge dialog pre-filled with
  // that beneficiary as the source. A ref keeps the pre-fill alive
  // across the close/open transition without re-renders.
  const pendingMergeSourceRef = useRef<number | null>(null);

  // Modal motion origins. The add dialog grows out of the "+ Add New" CTA; the
  // edit dialog grows out of (and collapses back onto) the clicked row — captured
  // by id at open time (the row stays put, so origin == "the saved row" → it
  // pairs with the row-highlight-on-save). T-nav-ia-reorg #6.
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const editOriginRef = useRef<HTMLElement | null>(null);

  function openEditFor(uid: number) {
    editOriginRef.current = document.getElementById(`beneficiary-row-${uid}`);
    editModal.openWith(String(uid));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beneficiaries.filter((b) => {
      if (typeFilter !== 'all' && b.beneficiary_type !== typeFilter)
        return false;
      if (!q) return true;
      const inName = b.name?.toLowerCase().includes(q);
      const inAliases = (b.aliases || []).some((a) =>
        a.toLowerCase().includes(q)
      );
      return Boolean(inName || inAliases);
    });
  }, [beneficiaries, search, typeFilter]);

  const editingBeneficiary = useMemo(() => {
    if (!editModal.value) return null;
    const uid = parseInt(editModal.value, 10);
    return beneficiaries.find((b) => b.uid === uid) ?? null;
  }, [editModal.value, beneficiaries]);

  async function handleDelete() {
    if (!confirmDelete) return;
    setActionError(null);
    setDeleting(true);
    try {
      await deleteBeneficiaryRequest(String(confirmDelete.uid));
      await invalidateOnly();
      setConfirmDelete(null);
    } catch (err) {
      const e = err as ApiErrorShape;
      setActionError(e.detail || e.error || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaved(b: Beneficiary) {
    await queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all });
    if (b?.uid != null) flash(b.uid);
  }

  // Stable wrapper for callbacks that don't carry a beneficiary back
  // (e.g. delete confirmation refetch). Keeps a single invalidate
  // call path without surfacing an undefined uid to `flash`.
  async function invalidateOnly() {
    await queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all });
  }

  // From the edit modal → "Merge…" footer button. Close the edit
  // modal, then open merge pre-filled with the in-edit beneficiary as
  // the source. After the merge dialog closes the ref is reset so the
  // next free-form merge starts clean.
  function handleRequestMerge() {
    const sourceUid = editingBeneficiary?.uid;
    editModal.close();
    if (sourceUid != null) {
      pendingMergeSourceRef.current = sourceUid;
    }
    mergeModal.open();
  }

  function handleMergeClose() {
    pendingMergeSourceRef.current = null;
    mergeModal.close();
  }

  const loadError =
    error && typeof error === 'object'
      ? (error as ApiErrorShape).detail ||
        (error as ApiErrorShape).error ||
        'Failed to load'
      : null;

  return (
    <div className="mx-auto my-8 max-w-3xl px-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Beneficiaries
          </h1>
          <Link
            to="/dashboard"
            className="tap-press text-accent-600 hover:text-accent-700 focus-visible:ring-accent-500 dark:text-accent-400 dark:hover:text-accent-300 inline-block text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={mergeModal.open}
            className="tap-press border-warning-300 bg-warning-50 text-warning-800 hover:bg-warning-100 dark:border-warning-900/50 dark:bg-warning-950/40 dark:text-warning-300 dark:hover:bg-warning-950/60 rounded-md border px-4 py-2 text-sm font-semibold transition-colors"
          >
            Merge
          </button>
          <Button ref={addBtnRef} variant="primary" onClick={addModal.open}>
            + Add New
          </Button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name or alias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input min-w-[200px] flex-1"
        />
        <select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="form-input w-auto"
        >
          <option value="all">All types</option>
          <option value="merchant">Merchant</option>
          <option value="person">Person</option>
        </select>
      </div>

      <BeneficiaryTable
        rows={filtered}
        isLoading={isLoading}
        highlightUid={highlightUid}
        onOpen={openEditFor}
      />

      {(loadError || actionError) && (
        <div className="form-error mt-4">{loadError ?? actionError}</div>
      )}

      {/*
        Broken-deep-link banner: ?edit=<uid> was set but no beneficiary
        with that uid is in the loaded list. Happens when an old
        bookmark / shared URL points at a since-deleted (or otherwise
        unknown) beneficiary. Dismissing clears the URL param.
      */}
      {editModal.value && !isLoading && !editingBeneficiary && (
        <BeneficiaryNotFoundBanner onDismiss={editModal.close} />
      )}

      <BeneficiaryFormDialog
        open={addModal.isOpen}
        onClose={addModal.close}
        onSaved={handleSaved}
        originRef={addBtnRef}
      />
      <BeneficiaryFormDialog
        open={editModal.isOpen && !!editingBeneficiary}
        onClose={editModal.close}
        onSaved={handleSaved}
        beneficiary={editingBeneficiary}
        originRef={editOriginRef}
        onRequestMerge={handleRequestMerge}
        onRequestRemove={
          editingBeneficiary
            ? () => setConfirmDelete(editingBeneficiary)
            : undefined
        }
      />
      <MergeBeneficiariesDialog
        open={mergeModal.isOpen}
        onClose={handleMergeClose}
        onMerged={invalidateOnly}
        beneficiaries={beneficiaries}
        initialSourceUid={pendingMergeSourceRef.current}
      />
      <ConfirmDialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          await handleDelete();
          // Close the edit modal if Remove was triggered from inside
          // it (Modal-header convention). Row-button deletes already
          // close cleanly; the modal-Trash path needs the explicit
          // dismiss so the user doesn't see a stale "not found" state.
          editModal.close();
        }}
        intent="danger"
        title="Delete beneficiary"
        message={
          confirmDelete
            ? `Delete beneficiary "${confirmDelete.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        busy={deleting}
      />
    </div>
  );
}

interface BeneficiaryTableProps {
  rows: Beneficiary[];
  isLoading: boolean;
  highlightUid: number | null;
  onOpen: (uid: number) => void;
}

// The list table. Body via early returns (loading / empty / list) instead
// of a nested ternary in the JSX — keeps it off sonarjs/no-nested-conditional.
function BeneficiaryTable({
  rows,
  isLoading,
  highlightUid,
  onOpen,
}: BeneficiaryTableProps) {
  function renderRows() {
    if (isLoading) {
      return (
        <tr>
          <td
            colSpan={4}
            className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
          >
            Loading...
          </td>
        </tr>
      );
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td
            colSpan={4}
            className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
          >
            No beneficiaries found.
          </td>
        </tr>
      );
    }
    return rows.map((b) => (
      <tr
        key={b.uid}
        id={`beneficiary-row-${b.uid}`}
        className={`border-t border-slate-100 transition-colors dark:border-slate-800 ${highlightClass(
          highlightUid === b.uid,
          'surface'
        )}`}
      >
        <td className="px-4 py-3 font-semibold">
          <span className="inline-flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(b.uid)}
              className="tap-press text-accent-600 hover:text-accent-700 focus-visible:ring-accent-500 dark:text-accent-400 dark:hover:text-accent-300 text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
            >
              {b.name}
            </button>
            {b.is_system && <SystemChip />}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          {formatAliasesDisplay(b.aliases)}
        </td>
        <td className="px-4 py-3 text-sm text-slate-700 capitalize dark:text-slate-200">
          {b.beneficiary_type || '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => onOpen(b.uid)}
            aria-label={`View / edit beneficiary ${b.name}`}
            title="View / edit"
            className="tap-press focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <MoreHorizontal aria-hidden size={16} />
          </button>
        </td>
      </tr>
    ));
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
      <table className="w-full min-w-[28rem] border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr className="text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3" />
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>{renderRows()}</tbody>
      </table>
    </div>
  );
}

// Broken-deep-link banner: ?edit=<uid> was set but no beneficiary with that
// uid is in the loaded list (old bookmark / shared URL pointing at a
// since-deleted beneficiary). Dismissing clears the URL param.
function BeneficiaryNotFoundBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="border-warning-300 bg-warning-50 text-warning-900 dark:border-warning-900/50 dark:bg-warning-950/40 dark:text-warning-200 mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm">
      <div>
        <strong className="font-semibold">Beneficiary not found.</strong> The
        link you followed points at a beneficiary that no longer exists (or that
        you don&rsquo;t have access to).
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="tap-press border-warning-400 text-warning-800 hover:bg-warning-100 dark:border-warning-700 dark:text-warning-300 dark:hover:bg-warning-950/60 shrink-0 rounded-md border bg-white px-3 py-1 text-xs font-semibold transition-colors dark:bg-slate-900"
      >
        Dismiss
      </button>
    </div>
  );
}
