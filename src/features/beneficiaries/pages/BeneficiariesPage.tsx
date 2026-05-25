import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatAliasesDisplay } from '../api/aliases';
import { beneficiaryKeys } from '../api/keys';
import { createBeneficiaryRequest } from '../api/mutations';
import { useBeneficiariesQuery } from '../api/queries';
import {
  emptyBeneficiaryForm,
  formToPayload,
  type BeneficiaryFormInput,
} from '../api/schemas';
import { BeneficiaryFormFields } from '../components/BeneficiaryFormFields';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

type TypeFilter = 'all' | 'merchant' | 'person';

export function BeneficiariesPage() {
  const queryClient = useQueryClient();
  const { data: beneficiaries = [], isLoading, error } = useBeneficiariesQuery();

  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<BeneficiaryFormInput>(
    emptyBeneficiaryForm('merchant')
  );
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [aliasInvalid, setAliasInvalid] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  function handleAddNew() {
    setNewForm(emptyBeneficiaryForm('merchant'));
    setShowAdd(true);
    setSubmitError(null);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (aliasInvalid) return;

    if (newForm.beneficiary_type === 'merchant' && newForm.category) {
      const proceed = window.confirm(
        'Assigning a category to this new merchant will automatically create a categorization rule for it. This will automatically categorize any matching statement transactions in the future. Do you want to proceed?'
      );
      if (!proceed) return;
    }

    try {
      await createBeneficiaryRequest(formToPayload(newForm));
      setShowAdd(false);
      setNewForm(emptyBeneficiaryForm('merchant'));
      await queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all });
    } catch (err) {
      const e = err as ApiErrorShape;
      setSubmitError(e.detail || e.error || 'Failed to create');
    }
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
        <div className="flex items-center gap-3">
          {showAdd ? (
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewForm(emptyBeneficiaryForm('merchant'));
                setSubmitError(null);
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddNew}
              className="btn-primary !w-auto"
            >
              + Add New
            </button>
          )}
        </div>
      </header>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
        >
          <BeneficiaryFormFields
            form={newForm}
            setForm={setNewForm}
            onAliasValidityChange={setAliasInvalid}
          />
          {submitError && <div className="form-error mb-3">{submitError}</div>}
          <button
            type="submit"
            disabled={aliasInvalid}
            className="btn-primary !w-auto"
          >
            Create
          </button>
        </form>
      )}

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

      {/*
        Responsive contract (CONTRIBUTING.md §6): tables get a
        horizontal scroll *inside the surface* rather than letting body
        overflow. `overflow-x-auto` on the card + `min-w` on the table
        keeps columns readable on phone widths without breaking the
        desktop layout.
      */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <table className="w-full min-w-[28rem] border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr className="text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                >
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                >
                  No beneficiaries found.
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr
                  key={b.uid}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      to={`/beneficiaries/${b.uid}`}
                      className="text-indigo-600 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatAliasesDisplay(b.aliases)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize dark:text-slate-200">
                    {b.beneficiary_type || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loadError && <div className="form-error mt-4">{loadError}</div>}
    </div>
  );
}
