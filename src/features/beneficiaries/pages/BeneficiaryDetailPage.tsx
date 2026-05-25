import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { beneficiaryKeys } from '../api/keys';
import {
  deleteBeneficiaryRequest,
  mergeBeneficiariesRequest,
  updateBeneficiaryRequest,
} from '../api/mutations';
import {
  fetchBeneficiaries,
  fetchBeneficiary,
  fetchCategorizationRules,
  type Beneficiary,
} from '../api/queries';
import {
  beneficiaryToForm,
  formToPayload,
  type BeneficiaryFormInput,
} from '../api/schemas';
import { BeneficiaryFormFields } from '../components/BeneficiaryFormFields';
import { MergeBeneficiariesForm } from '../components/MergeBeneficiariesForm';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface ActionDropdownProps {
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function ActionDropdown({
  editing,
  onEdit,
  onCancel,
  onDelete,
}: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div className="flex items-center overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={editing ? onCancel : onEdit}
          className="border-r border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-label="More actions"
            className="px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ▼
          </button>
        )}
      </div>

      {isOpen && !editing && (
        <div className="absolute top-full right-0 z-10 mt-1 min-w-[110px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function BeneficiaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [allBeneficiaries, setAllBeneficiaries] = useState<Beneficiary[]>([]);
  const [form, setForm] = useState<BeneficiaryFormInput | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [aliasInvalid, setAliasInvalid] = useState(false);

  const loadBeneficiary = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchBeneficiary(id), fetchBeneficiaries()])
      .then(([b, list]) => {
        setBeneficiary(b);
        setForm(beneficiaryToForm(b));
        setAllBeneficiaries(list);
        setMergeSource(String(b.uid));
      })
      .catch((err: ApiErrorShape) =>
        setError(err.detail || 'Failed to load beneficiary')
      )
      .finally(() => setLoading(false));
  };

  useEffect(loadBeneficiary, [id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (aliasInvalid || !beneficiary || !form || !id) return;

    if (
      beneficiary.beneficiary_type === 'merchant' &&
      form.beneficiary_type === 'person'
    ) {
      const proceed = window.confirm(
        'Changing this beneficiary from Merchant to Person will delete its merchant details. The categorization rule mapping will be preserved. Do you want to proceed?'
      );
      if (!proceed) return;
    }

    if (form.beneficiary_type === 'merchant') {
      const originalCategory = beneficiary.merchant?.category || '';
      const newCategory = form.category || '';
      if (originalCategory !== newCategory && newCategory !== '') {
        try {
          const res = await fetchCategorizationRules();
          const rule = (res.rules || []).find(
            (r) => r.beneficiary_id === beneficiary.uid
          );
          const isNewTag =
            !rule ||
            !rule.tag_ids ||
            !rule.tag_ids.includes(parseInt(newCategory, 10));
          if (isNewTag) {
            const proceed = window.confirm(
              'Changing the merchant category will automatically create or update the corresponding categorization rule. This will re-categorize all related statement transactions and update your budgets. Do you want to proceed?'
            );
            if (!proceed) return;
          }
        } catch (err) {
          console.error('Failed to verify categorization rule tags', err);
        }
      }
    }

    try {
      const updated = await updateBeneficiaryRequest(id, formToPayload(form));
      setBeneficiary(updated);
      setForm(beneficiaryToForm(updated));
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all });
    } catch (err) {
      const e = err as ApiErrorShape;
      alert(e.detail || 'Update failed');
    }
  }

  async function handleDelete() {
    if (!beneficiary || !id) return;
    if (
      !window.confirm(
        `Delete beneficiary "${beneficiary.name}"? This cannot be undone.`
      )
    )
      return;
    try {
      await deleteBeneficiaryRequest(id);
      await queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all });
      navigate('/beneficiaries');
    } catch (err) {
      const e = err as ApiErrorShape;
      alert(e.detail || 'Delete failed');
    }
  }

  async function handleMerge() {
    if (!mergeSource || !mergeTarget) return;
    if (mergeSource === mergeTarget) return;
    if (
      !window.confirm(
        'Merging will consolidate all aliases and update all transaction links. This cannot be undone. Proceed?'
      )
    )
      return;
    try {
      await mergeBeneficiariesRequest({
        source_uid: parseInt(mergeSource, 10),
        target_uid: parseInt(mergeTarget, 10),
      });
      await queryClient.invalidateQueries({ queryKey: beneficiaryKeys.all });
      if (mergeSource === String(id)) {
        navigate(`/beneficiaries/${mergeTarget}`);
      } else {
        loadBeneficiary();
        setMergeTarget('');
      }
    } catch (err) {
      const e = err as ApiErrorShape;
      alert(e.detail || 'Merge failed');
    }
  }

  function handleSwap() {
    setMergeSource(mergeTarget);
    setMergeTarget(mergeSource);
  }

  function handleCancelEdit() {
    if (beneficiary) setForm(beneficiaryToForm(beneficiary));
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="mx-auto my-8 max-w-2xl px-4 text-sm text-slate-400 dark:text-slate-500">
        Loading...
      </div>
    );
  }

  if (error || !beneficiary || !form) {
    return (
      <div className="mx-auto my-8 max-w-2xl px-4">
        <p className="form-error mb-3">{error || 'Beneficiary not found'}</p>
        <Link
          to="/beneficiaries"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to All Beneficiaries
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto my-8 max-w-2xl px-4">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/beneficiaries"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
          >
            ← Back to All Beneficiaries
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {beneficiary.name}
          </h1>
        </div>
        <ActionDropdown
          editing={editing}
          onEdit={() => setEditing(true)}
          onCancel={handleCancelEdit}
          onDelete={handleDelete}
        />
      </header>

      <form
        onSubmit={handleSave}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
      >
        <BeneficiaryFormFields
          form={form}
          setForm={setForm}
          readOnly={!editing}
          excludeUid={parseInt(id ?? '0', 10) || null}
          onAliasValidityChange={setAliasInvalid}
        />
        {editing && (
          <button
            type="submit"
            disabled={aliasInvalid}
            className="btn-primary !w-auto"
          >
            Save Changes
          </button>
        )}
      </form>

      {editing && (
        <MergeBeneficiariesForm
          beneficiaries={allBeneficiaries}
          mergeSource={mergeSource}
          mergeTarget={mergeTarget}
          onSourceChange={setMergeSource}
          onTargetChange={setMergeTarget}
          onSwap={handleSwap}
          onMerge={handleMerge}
        />
      )}
    </div>
  );
}
