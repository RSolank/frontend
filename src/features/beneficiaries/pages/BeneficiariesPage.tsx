import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useModal, useUrlValueModal } from '../../../shared/hooks/useModal';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { formatAliasesDisplay } from '../api/aliases';
import { beneficiaryKeys } from '../api/keys';
import { deleteBeneficiaryRequest } from '../api/mutations';
import {
  type Beneficiary,
  useBeneficiariesQuery,
} from '../api/queries';
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
  const { data: beneficiaries = [], isLoading, error } = useBeneficiariesQuery();

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
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={mergeModal.open}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
          >
            Merge
          </button>
          <button
            type="button"
            onClick={addModal.open}
            className="btn-primary !w-auto"
          >
            + Add New
          </button>
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
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                >
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                >
                  No beneficiaries found.
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr
                  key={b.uid}
                  className={`border-t border-slate-100 transition-colors dark:border-slate-800 ${
                    highlightUid === b.uid
                      ? 'bg-indigo-50/60 ring-2 ring-indigo-500 ring-inset dark:bg-indigo-950/30'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => editModal.openWith(String(b.uid))}
                      className="text-left text-indigo-600 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
                    >
                      {b.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatAliasesDisplay(b.aliases)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize dark:text-slate-200">
                    {b.beneficiary_type || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => editModal.openWith(String(b.uid))}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(b)}
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(loadError || actionError) && (
        <div className="form-error mt-4">{loadError ?? actionError}</div>
      )}

      {/*
        Broken-deep-link banner: ?edit=<uid> was set but no beneficiary
        with that uid is in the loaded list. Happens when an old
        bookmark / shared URL points at a since-deleted (or otherwise
        unknown) beneficiary. Dismissing clears the URL param.
      */}
      {editModal.value &&
        !isLoading &&
        !editingBeneficiary && (
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <div>
              <strong className="font-semibold">Beneficiary not found.</strong>{' '}
              The link you followed points at a beneficiary that no
              longer exists (or that you don't have access to).
            </div>
            <button
              type="button"
              onClick={editModal.close}
              className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/60"
            >
              Dismiss
            </button>
          </div>
        )}

      <BeneficiaryFormDialog
        open={addModal.isOpen}
        onClose={addModal.close}
        onSaved={handleSaved}
      />
      <BeneficiaryFormDialog
        open={editModal.isOpen && !!editingBeneficiary}
        onClose={editModal.close}
        onSaved={handleSaved}
        beneficiary={editingBeneficiary}
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
